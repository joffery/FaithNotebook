import { useEffect, useState } from 'react';
import { LockKeyhole, Mail, NotebookPen, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CHURCH_OPTIONS } from '../constants/churches';
import { ProfileAvatar } from './ProfileAvatar';

type ProfileSettingsModalProps = {
  onClose: () => void;
  onOpenMyNotes: () => void;
  onSignedOut?: () => void;
};

export function ProfileSettingsModal({ onClose, onOpenMyNotes, onSignedOut }: ProfileSettingsModalProps) {
  const {
    profile,
    profileLoading,
    updateProfileDetails,
    updatePassword,
    signOut,
  } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [churchAffiliation, setChurchAffiliation] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name || profile?.username || '');
    setRecoveryEmail(profile?.recovery_email || '');
    setChurchAffiliation(profile?.church_affiliation || '');
  }, [profile]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setSavingProfile(true);

    const { error } = await updateProfileDetails({
      displayName,
      recoveryEmail,
      churchAffiliation,
    });

    if (error) {
      setProfileError(error.message || 'Please try again.');
      setSavingProfile(false);
      return;
    }

    setProfileMessage('Your account details were updated.');
    setSavingProfile(false);
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (newPassword.trim().length < 6) {
      setPasswordError('Please use at least 6 characters for your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Those passwords did not match.');
      return;
    }

    setSavingPassword(true);
    const { error } = await updatePassword(newPassword);
    if (error) {
      setPasswordError(error.message || 'Please try again.');
      setSavingPassword(false);
      return;
    }

    setPasswordMessage('Your password was updated.');
    setNewPassword('');
    setConfirmPassword('');
    setSavingPassword(false);
  };

  const handleSignOut = async () => {
    setSignOutError('');
    setSigningOut(true);

    const { error } = await signOut();
    if (error) {
      setSignOutError(error.message || 'Please try again.');
      setSigningOut(false);
      return;
    }

    setSigningOut(false);
    onSignedOut?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/45 overflow-y-auto overscroll-contain">
      <div className="min-h-full sm:min-h-0 flex items-start sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-none sm:rounded-2xl bg-[#faf8f4] shadow-2xl border-0 sm:border border-[#c49a5c]/20 p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] max-h-none sm:max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <ProfileAvatar
              displayName={profile?.display_name || profile?.username || 'Profile'}
              avatarUrl={profile?.avatar_url}
              size="md"
            />
            <div>
              <h2 className="text-xl font-serif text-[#2c1810]">Profile & Account</h2>
              <p className="text-sm text-[#2c1810]/65">
                Keep your name, church, recovery email, and password up to date.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810] transition-colors"
            aria-label="Close profile settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6">
          <form onSubmit={handleProfileSave} className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 p-4 space-y-4">
            <div>
              <h3 className="text-lg font-serif text-[#2c1810]">Profile</h3>
              <p className="text-sm text-[#2c1810]/60 mt-1">
                This is how other disciples will recognize you in the app and on shared notes.
              </p>
            </div>

            <div>
              <label htmlFor="profile-username" className="block text-sm font-medium text-[#2c1810] mb-2">
                Sign-In Username
              </label>
              <input
                id="profile-username"
                type="text"
                value={profile?.username || ''}
                readOnly
                className="w-full rounded-lg border border-[#c49a5c]/20 bg-[#f6f1e8] px-4 py-3 text-[#2c1810]/65"
              />
              <p className="mt-2 text-xs text-[#2c1810]/55">
                Keep using this same username when you sign in. Shared notes use your name, not this username.
              </p>
            </div>

            <div>
              <label htmlFor="profile-display-name" className="block text-sm font-medium text-[#2c1810] mb-2">
                Name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/35" />
                <input
                  id="profile-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={savingProfile || profileLoading}
                  placeholder="The name people at church know you by"
                  className="w-full rounded-lg border border-[#c49a5c]/25 bg-white pl-10 pr-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-church" className="block text-sm font-medium text-[#2c1810] mb-2">
                Church
              </label>
              <select
                id="profile-church"
                value={churchAffiliation}
                onChange={(e) => setChurchAffiliation(e.target.value)}
                disabled={savingProfile || profileLoading}
                className="w-full rounded-lg border border-[#c49a5c]/25 bg-white px-4 py-3 text-[#2c1810] focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
              >
                <option value="">Select your church</option>
                {CHURCH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="profile-recovery-email" className="block text-sm font-medium text-[#2c1810] mb-2">
                Recovery Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/35" />
                <input
                  id="profile-recovery-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  disabled={savingProfile || profileLoading}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-[#c49a5c]/25 bg-white pl-10 pr-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
                />
              </div>
              <p className="mt-2 text-xs text-[#2c1810]/55">
                This email is used for password recovery. Your sign-in username stays the same.
              </p>
            </div>

            {profileError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-sm text-red-700">{profileError}</p>
              </div>
            )}

            {profileMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <p className="text-sm text-green-700">{profileMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile || profileLoading}
              className="w-full rounded-lg bg-[#c49a5c] px-4 py-3 text-white text-sm font-medium hover:bg-[#b38a4d] transition-colors disabled:opacity-50"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          <form onSubmit={handlePasswordSave} className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 p-4 space-y-4">
            <div>
              <h3 className="text-lg font-serif text-[#2c1810]">Password</h3>
              <p className="text-sm text-[#2c1810]/60 mt-1">
                Update your password without creating a new account.
              </p>
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-[#2c1810] mb-2">
                New Password
              </label>
              <div className="relative">
                <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/35" />
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={savingPassword}
                  placeholder="At least 6 characters"
                  className="w-full rounded-lg border border-[#c49a5c]/25 bg-white pl-10 pr-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-[#2c1810] mb-2">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={savingPassword}
                placeholder="Type it again"
                className="w-full rounded-lg border border-[#c49a5c]/25 bg-white px-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
              />
            </div>

            {passwordError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-sm text-red-700">{passwordError}</p>
              </div>
            )}

            {passwordMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <p className="text-sm text-green-700">{passwordMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="w-full rounded-lg bg-[#2c1810] px-4 py-3 text-white text-sm font-medium hover:bg-[#1f120c] transition-colors disabled:opacity-50"
            >
              {savingPassword ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>

          <div className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 p-4 space-y-3">
            <div>
              <h3 className="text-lg font-serif text-[#2c1810]">My Notes</h3>
              <p className="text-sm text-[#2c1810]/60 mt-1">
                Reopen the Scriptures where you wrote your own reflections and see which notes you already shared.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMyNotes}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#c49a5c]/25 bg-white px-4 py-3 text-sm font-medium text-[#2c1810] hover:bg-[#c49a5c]/10 transition-colors"
            >
              <NotebookPen size={16} />
              <span>Open Scripture Notes</span>
            </button>
          </div>

          <div className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 p-4 space-y-2">
            <div>
              <h3 className="text-lg font-serif text-[#2c1810]">Add to Home Screen</h3>
              <p className="text-sm text-[#2c1810]/60 mt-1 leading-relaxed">
                Put Faith Notebook on your phone like an app so it is easier to come back to each day.
              </p>
            </div>
            <div className="rounded-xl bg-[#f6efe3] px-3 py-3 text-sm text-[#2c1810]/75 leading-relaxed">
              <p>On iPhone: open this site in Safari, tap Share, then choose <span className="font-medium text-[#2c1810]">Add to Home Screen</span>.</p>
              <p className="mt-2">On Android: open the browser menu, then choose <span className="font-medium text-[#2c1810]">Add to Home screen</span> or <span className="font-medium text-[#2c1810]">Install app</span>.</p>
            </div>
          </div>

          <div className="space-y-2">
            {signOutError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-sm text-red-700">{signOutError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => { void handleSignOut(); }}
              disabled={signingOut}
              className="w-full rounded-lg border border-[#c49a5c]/25 bg-white px-4 py-3 text-sm font-medium text-[#2c1810] hover:bg-[#c49a5c]/10 transition-colors disabled:opacity-50"
            >
              {signingOut ? 'Signing Out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
