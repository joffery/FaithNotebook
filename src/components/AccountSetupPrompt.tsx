import { useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type AccountSetupPromptProps = {
  onClose: () => void;
};

export function AccountSetupPrompt({ onClose }: AccountSetupPromptProps) {
  const { completeAccountSetup, profile, profileLoading } = useAuth();
  const [displayName, setDisplayName] = useState(
    profile?.display_name || profile?.username || ''
  );
  const [email, setEmail] = useState(profile?.recovery_email || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const { error: saveError } = await completeAccountSetup({
      recoveryEmail: email,
      displayName,
    });

    if (saveError) {
      setError(saveError.message || 'Please try again.');
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/45 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#faf8f4] shadow-2xl border border-[#c49a5c]/20 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="mt-1 rounded-full bg-[#c49a5c]/12 p-2 text-[#c49a5c]">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="text-xl font-serif text-[#2c1810]">Complete Account Setup</h2>
            <p className="mt-1 text-sm text-[#2c1810]/65 leading-relaxed">
              Add your email so we can help you recover this same account later. Your notes and history stay connected here.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="display-name" className="block text-sm font-medium text-[#2c1810] mb-2">
              Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="The name people at church know you by"
              disabled={saving || profileLoading}
              className="w-full rounded-lg border border-[#c49a5c]/25 bg-white px-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
            />
            <p className="mt-2 text-xs text-[#2c1810]/55">
              This is the name other disciples will see on shared notes.
            </p>
          </div>

          <div>
            <label htmlFor="recovery-email" className="block text-sm font-medium text-[#2c1810] mb-2">
              Recovery Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/35" />
              <input
                id="recovery-email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={saving || profileLoading}
                className="w-full rounded-lg border border-[#c49a5c]/25 bg-white pl-10 pr-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 disabled:opacity-60"
              />
            </div>
            <p className="mt-2 text-xs text-[#2c1810]/55">
              You will still keep signing in the same way for now. This simply prepares your account for safer recovery later.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm text-[#2c1810]/65 hover:text-[#2c1810] transition-colors disabled:opacity-50"
            >
              Later
            </button>
            <button
              type="submit"
              disabled={!email.trim() || !displayName.trim() || saving || profileLoading}
              className="px-4 py-2 rounded-lg bg-[#c49a5c] text-white text-sm font-medium hover:bg-[#b38a4d] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
