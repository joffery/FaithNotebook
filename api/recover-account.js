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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return json(res, 500, { error: 'Account recovery is not configured yet.' });
  }

  const username = String(req.body?.username || '').trim();
  const recoveryEmail = String(req.body?.recoveryEmail || '').trim().toLowerCase();
  const newPassword = String(req.body?.newPassword || '').trim();

  if (!username || !recoveryEmail || newPassword.length < 6) {
    return json(res, 400, {
      error: 'Please enter your username, recovery email, and a new password with at least 6 characters.',
    });
  }

  try {
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, username, recovery_email')
      .eq('username', username)
      .maybeSingle();

    if (profileError) {
      console.error('recover-account profile lookup failed:', profileError);
      return json(res, 500, { error: 'We could not recover this account right now. Please try again.' });
    }

    if (!profile?.id || !profile?.recovery_email || profile.recovery_email.toLowerCase() !== recoveryEmail) {
      return json(res, 400, {
        error: 'That username and recovery email did not match the same account.',
      });
    }

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
