import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { Database, supabase } from '../lib/supabase';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type SignUpInput = {
  username: string;
  password: string;
  churchAffiliation?: string | null;
};
type ProfileDetailsInput = {
  displayName: string;
  recoveryEmail: string;
  churchAffiliation?: string | null;
};

const LEGACY_EMAIL_SUFFIX = '@faith.local';
const AUTH_OPERATION_TIMEOUT_MS = 8000;
const USERNAME_ALLOWED_PATTERN = /^[a-zA-Z0-9._-]+$/;

const isValidRecoveryEmail = (value: string | null | undefined) =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const getLegacyUsernameFromEmail = (email?: string | null) => {
  if (!email) return null;
  const trimmed = email.trim();
  return trimmed.toLowerCase().endsWith(LEGACY_EMAIL_SUFFIX)
    ? trimmed.slice(0, -LEGACY_EMAIL_SUFFIX.length)
    : null;
};

const getRememberedUsername = () => {
  const saved = localStorage.getItem('lastUsername');
  return saved?.trim() ? saved.trim() : null;
};

const normalizeChurchAffiliation = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const validateUsernameForRegistration = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.length < 3) {
    return 'Please use at least 3 characters for your username.';
  }

  if (trimmed.includes('@')) {
    return 'Please choose a username, not an email address.';
  }

  if (!USERNAME_ALLOWED_PATTERN.test(trimmed)) {
    return 'Please use only letters, numbers, periods, underscores, or hyphens in your username.';
  }

  return null;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: number | null = null;
  return new Promise<T>((resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);

    promise.then(
      (value) => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        resolve(value);
      },
      (error) => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        reject(error);
      }
    );
  });
};

const isMissingChurchAffiliationColumnError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return message.includes('church_affiliation');
};

const isMissingProfileUpgradeColumnError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    message.includes('username') ||
    message.includes('recovery_email') ||
    message.includes('account_setup_completed_at') ||
    message.includes('avatar_url') ||
    message.includes('church_affiliation')
  );
};

interface AuthContextType {
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  profileLoading: boolean;
  needsAccountSetup: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (input: SignUpInput) => Promise<{ error: Error | null }>;
  completeAccountSetup: (input: ProfileDetailsInput) => Promise<{ error: Error | null }>;
  updateProfileDetails: (input: ProfileDetailsInput) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  profileLoading: true,
  needsAccountSetup: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  completeAccountSetup: async () => ({ error: null }),
  updateProfileDetails: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error);
      return null;
    }

    return data as ProfileRow | null;
  };

  const ensureProfileWithTimeout = async (
    authUser: User,
    usernameHint?: string | null,
    churchAffiliationHint?: string | null
  ) => {
    try {
      return await withTimeout(
        ensureProfile(authUser, usernameHint, churchAffiliationHint),
        AUTH_OPERATION_TIMEOUT_MS,
        'Loading profile'
      );
    } catch (error) {
      console.error('Falling back after profile load issue:', error);
      return null;
    }
  };

  const ensureProfile = async (
    authUser: User,
    usernameHint?: string | null,
    churchAffiliationHint?: string | null
  ) => {
    const fallbackUsername = usernameHint?.trim() || getLegacyUsernameFromEmail(authUser.email) || getRememberedUsername();
    const fallbackChurchAffiliation = normalizeChurchAffiliation(churchAffiliationHint);
    const existingProfile = await loadProfile(authUser.id);

    if (!existingProfile) {
      const now = new Date().toISOString();
      let { error } = await supabase.from('profiles').insert({
        id: authUser.id,
        display_name: fallbackUsername || 'Bible Reader',
        username: fallbackUsername,
        church_affiliation: fallbackChurchAffiliation,
        created_at: now,
        updated_at: now,
      });

      if (error && isMissingProfileUpgradeColumnError(error)) {
        const fallback = await supabase.from('profiles').insert({
          id: authUser.id,
          display_name: fallbackUsername || 'Bible Reader',
          created_at: now,
          updated_at: now,
        });
        error = fallback.error;
      }

      if (error) {
        console.error('Failed to create profile:', error);
        return null;
      }

      return await loadProfile(authUser.id);
    }

    const updates: Database['public']['Tables']['profiles']['Update'] = {};
    if (!existingProfile.username?.trim() && fallbackUsername) {
      updates.username = fallbackUsername;
    }
    if (!existingProfile.display_name?.trim() && fallbackUsername) {
      updates.display_name = fallbackUsername;
    }
    if (!existingProfile.church_affiliation && fallbackChurchAffiliation) {
      updates.church_affiliation = fallbackChurchAffiliation;
    }

    if (Object.keys(updates).length === 0) {
      return existingProfile;
    }

    let { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authUser.id);

    if (error && isMissingProfileUpgradeColumnError(error)) {
      const fallbackUpdates: Database['public']['Tables']['profiles']['Update'] = {};
      if (updates.display_name) {
        fallbackUpdates.display_name = updates.display_name;
      }

      if (Object.keys(fallbackUpdates).length > 0) {
        const fallback = await supabase
          .from('profiles')
          .update({
            ...fallbackUpdates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', authUser.id);
        error = fallback.error;
      } else {
        error = null;
      }
    }

    if (error) {
      console.error('Failed to backfill profile fields:', error);
      return existingProfile;
    }

    return await loadProfile(authUser.id);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const sessionResult = await withTimeout<Awaited<ReturnType<typeof supabase.auth.getSession>>>(
          supabase.auth.getSession(),
          AUTH_OPERATION_TIMEOUT_MS,
          'Restoring session'
        );
        const session = sessionResult.data.session;

        if (session?.user) {
          setUser(session.user);
          setProfileLoading(true);
          setProfile(await ensureProfileWithTimeout(session.user));
          setProfileLoading(false);
        } else {
          setProfile(null);
          setProfileLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setProfile(null);
        setProfileLoading(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setProfileLoading(true);
          setProfile(await ensureProfileWithTimeout(session.user));
          setProfileLoading(false);
        } else {
          setProfile(null);
          setProfileLoading(false);
        }
      })();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // username is used on the client; we map it to a local email for Supabase auth
  const toEmail = (username: string) => `${username.trim()}${LEGACY_EMAIL_SUFFIX}`;

  const signIn = async (username: string, password: string) => {
    const cleanUsername = username.trim();
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(cleanUsername),
      password,
    });
    if (!error) {
      localStorage.setItem('lastUsername', cleanUsername);
    }
    return { error };
  };

  const signUp = async ({ username, password, churchAffiliation }: SignUpInput) => {
    const cleanUsername = username.trim();
    const usernameValidationError = validateUsernameForRegistration(cleanUsername);
    if (usernameValidationError) {
      return { error: new Error(usernameValidationError) };
    }

    const normalizedChurchAffiliation = normalizeChurchAffiliation(churchAffiliation);
    const { data, error } = await supabase.auth.signUp({
      email: toEmail(cleanUsername),
      password,
    });

    // if sign up succeeded (user created), ensure profile has display_name
    if (!error && data?.user) {
      try {
        const now = new Date().toISOString();
        let { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: cleanUsername,
          username: cleanUsername,
          church_affiliation: normalizedChurchAffiliation,
          updated_at: now,
        });

        if (profileError && isMissingProfileUpgradeColumnError(profileError)) {
          const fallback = await supabase.from('profiles').upsert({
            id: data.user.id,
            display_name: cleanUsername,
            updated_at: now,
          });
          profileError = fallback.error;
        }

        if (profileError) {
          throw profileError;
        }
        localStorage.setItem('lastUsername', cleanUsername);
      } catch (e) {
        console.warn('Failed to create profile display_name:', e);
      }
    }

    return { error };
  };

  const saveProfileDetails = async ({
    recoveryEmail,
    displayName,
    churchAffiliation,
  }: ProfileDetailsInput) => {
    if (!user) {
      return { error: new Error('Please sign in again and try one more time.') };
    }

    const normalizedEmail = recoveryEmail.trim().toLowerCase();
    const normalizedDisplayName = displayName.trim();
    const normalizedChurchAffiliation = normalizeChurchAffiliation(churchAffiliation);
    if (!isValidRecoveryEmail(normalizedEmail)) {
      return { error: new Error('Please enter a valid email address.') };
    }
    if (!normalizedDisplayName) {
      return { error: new Error('Please enter the name people at church know you by.') };
    }

    setProfileLoading(true);

    try {
      const ensuredProfile = profile || await ensureProfile(user);
      const now = new Date().toISOString();
      let { data, error } = await supabase
        .from('profiles')
        .update({
          username: ensuredProfile?.username || getLegacyUsernameFromEmail(user.email) || getRememberedUsername(),
          display_name: normalizedDisplayName,
          recovery_email: normalizedEmail,
          recovery_email_added_at: ensuredProfile?.recovery_email_added_at || now,
          account_setup_completed_at: now,
          church_affiliation: normalizedChurchAffiliation,
          updated_at: now,
        })
        .eq('id', user.id)
        .select('*')
        .single();

      if (error && isMissingChurchAffiliationColumnError(error)) {
        const fallback = await supabase
          .from('profiles')
          .update({
            username: ensuredProfile?.username || getLegacyUsernameFromEmail(user.email) || getRememberedUsername(),
            display_name: normalizedDisplayName,
            recovery_email: normalizedEmail,
            recovery_email_added_at: ensuredProfile?.recovery_email_added_at || now,
            account_setup_completed_at: now,
            updated_at: now,
          })
          .eq('id', user.id)
          .select('*')
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error('Failed to complete account setup:', error);
        return {
          error: new Error(
            isMissingProfileUpgradeColumnError(error)
              ? 'This account setup needs the latest database migration before it can be saved.'
              : 'We could not save your email just now. Please try again.'
          ),
        };
      }

      setProfile(data as ProfileRow);
      return { error: null };
    } finally {
      setProfileLoading(false);
    }
  };

  const completeAccountSetup = async (input: ProfileDetailsInput) => saveProfileDetails(input);

  const updateProfileDetails = async (input: ProfileDetailsInput) => saveProfileDetails(input);

  const updatePassword = async (newPassword: string) => {
    const normalizedPassword = newPassword.trim();
    if (normalizedPassword.length < 6) {
      return { error: new Error('Please use at least 6 characters for your password.') };
    }

    const { error } = await supabase.auth.updateUser({ password: normalizedPassword });
    if (error) {
      console.error('Failed to update password:', error);
      return { error: new Error('We could not update your password just now. Please try again.') };
    }

    return { error: null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Failed to sign out:', error);
      return { error: new Error('We could not sign you out just now. Please try again.') };
    }

    setUser(null);
    setProfile(null);
    setProfileLoading(false);
    return { error: null };
  };

  const needsAccountSetup =
    !!user &&
    !!profile &&
    !profileLoading &&
    (!isValidRecoveryEmail(profile.recovery_email) || !profile.account_setup_completed_at);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        needsAccountSetup,
        signIn,
        signUp,
        completeAccountSetup,
        updateProfileDetails,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
