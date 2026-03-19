import { useEffect, useState } from 'react';
import { KeyRound, Mail, User, X } from 'lucide-react';

type RecoverAccountModalProps = {
  initialUsername?: string;
  onClose: () => void;
  onRecovered: (nextPassword: string) => void;
};

export function RecoverAccountModal({
  initialUsername = '',
  onClose,
  onRecovered,
}: RecoverAccountModalProps) {
  const [username, setUsername] = useState(initialUsername);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUsername(initialUsername);
  }, [initialUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.trim().length < 6) {
      setError('Please use at least 6 characters for your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Those passwords did not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/recover-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          recoveryEmail,
          newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error || 'We could not recover this account right now. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(data?.message || 'Your password was updated.');
      onRecovered(newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not recover this account right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#faf8f4] shadow-2xl border border-[#c49a5c]/20 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-serif text-[#2c1810]">Recover Account</h2>
            <p className="mt-1 text-sm text-[#2c1810]/65 leading-relaxed">
              Use the same username and the recovery email already connected to this account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810] transition-colors"
            aria-label="Close account recovery"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="recovery-username" className="block text-sm font-medium text-[#2c1810] mb-2">
              Sign-In Username
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/35" />
              <input
                id="recovery-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={loading}
                className="w-full rounded-lg border border-[#c49a5c]/25 bg-white pl-10 pr-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
                placeholder="Your username"
              />
            </div>
          </div>

          <div>
            <label htmlFor="recovery-email-field" className="block text-sm font-medium text-[#2c1810] mb-2">
              Recovery Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/35" />
              <input
                id="recovery-email-field"
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={loading}
                className="w-full rounded-lg border border-[#c49a5c]/25 bg-white pl-10 pr-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="recovery-new-password" className="block text-sm font-medium text-[#2c1810] mb-2">
              New Password
            </label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/35" />
              <input
                id="recovery-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-[#c49a5c]/25 bg-white pl-10 pr-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
                placeholder="At least 6 characters"
              />
            </div>
          </div>

          <div>
            <label htmlFor="recovery-confirm-password" className="block text-sm font-medium text-[#2c1810] mb-2">
              Confirm New Password
            </label>
            <input
              id="recovery-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-[#c49a5c]/25 bg-white px-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
              placeholder="Type it again"
            />
          </div>

          <p className="text-xs text-[#2c1810]/55 leading-relaxed">
            If this account never had a recovery email added before, this reset will not work yet. Sign in normally and add one in Profile & Account first whenever you can.
          </p>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#c49a5c] px-4 py-3 text-white text-sm font-medium hover:bg-[#b38a4d] transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating Password...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
