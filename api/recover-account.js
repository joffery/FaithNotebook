import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceKey);
};

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const LEGACY_EMAIL_SUFFIX = '@faith.local';

const normalizeUsername = (value) => String(value || '').trim().toLowerCase();

const getLegacyUsernameFromEmail = (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return '';

  if (normalizedEmail.endsWith(LEGACY_EMAIL_SUFFIX)) {
    return normalizedEmail.slice(0, -LEGACY_EMAIL_SUFFIX.length);
  }

  return normalizedEmail.split('@')[0] || '';
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return json(res, 500, { error: 'Account recovery is not configured yet.' });
  }

  const username = String(req.body?.username || '').trim();
  const normalizedUsername = normalizeUsername(username);
  const recoveryEmail = String(req.body?.recoveryEmail || '').trim().toLowerCase();
  const newPassword = String(req.body?.newPassword || '').trim();

  if (!username || !recoveryEmail || newPassword.length < 6) {
    return json(res, 400, {
      error: 'Please enter your username, recovery email, and a new password with at least 6 characters.',
    });
  }

  try {
    let { data: exactProfiles, error: profileError } = await admin
      .from('profiles')
      .select('id, username, recovery_email')
      .eq('recovery_email', recoveryEmail)
      .limit(10);

    if (profileError) {
      console.error('recover-account profile lookup failed:', profileError);
      return json(res, 500, { error: 'We could not recover this account right now. Please try again.' });
    }

    let candidateProfiles = exactProfiles || [];

    if (candidateProfiles.length === 0) {
      const fallback = await admin
        .from('profiles')
        .select('id, username, recovery_email')
        .ilike('recovery_email', recoveryEmail)
        .limit(10);

      if (fallback.error) {
        console.error('recover-account profile fallback lookup failed:', fallback.error);
        return json(res, 500, { error: 'We could not recover this account right now. Please try again.' });
      }

      candidateProfiles = fallback.data || [];
    }

    let matchingProfiles = candidateProfiles.filter((profile) =>
      normalizeUsername(profile?.username) === normalizedUsername
    );

    if (matchingProfiles.length === 0 && candidateProfiles.length > 0) {
      const authMatches = [];

      for (const profile of candidateProfiles) {
        if (!profile?.id) continue;

        const { data: authData, error: authError } = await admin.auth.admin.getUserById(profile.id);
        if (authError) {
          console.error('recover-account auth lookup failed:', authError);
          continue;
        }

        if (getLegacyUsernameFromEmail(authData?.user?.email) === normalizedUsername) {
          authMatches.push(profile);
        }
      }

      matchingProfiles = authMatches;
    }

    if (matchingProfiles.length !== 1) {
      return json(res, 400, {
        error: 'That username and recovery email did not match the same account.',
      });
    }

    const profile = matchingProfiles[0];

    const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('recover-account password update failed:', updateError);
      return json(res, 500, { error: 'We could not update your password right now. Please try again.' });
    }

    return json(res, 200, {
      ok: true,
      message: 'Your password was updated. You can sign in with your username and new password now.',
    });
  } catch (error) {
    console.error('recover-account unexpected error:', error);
    return json(res, 500, { error: 'We could not recover this account right now. Please try again.' });
  }
}
