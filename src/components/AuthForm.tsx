import { useEffect, useState } from 'react';
import { Book, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CHURCH_OPTIONS } from '../constants/churches';
import { RecoverAccountModal } from './RecoverAccountModal';

const toFriendlyAuthError = (message?: string) => {
  const text = message?.toLowerCase() || '';

  if (text.includes('invalid login credentials')) {
    return 'That username or password did not match. Please try again.';
  }

  if (text.includes('user already registered')) {
    return 'That username is already taken. Please sign in instead.';
  }

  if (text.includes('password')) {
    return 'Please check your password and try again.';
  }

  return 'Something went wrong. Please try again.';
};

export function AuthForm({ onClose }: { onClose?: () => void } = {}) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'create-account'>('sign-in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [churchAffiliation, setChurchAffiliation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('lastUsername');
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanUsername = username.trim();

      if (mode === 'sign-in') {
        const { error: signInError } = await signIn(cleanUsername, password);
        if (signInError) {
          setError(toFriendlyAuthError(signInError.message));
          return;
        }
      } else {
        const { error: signUpError } = await signUp({
          username: cleanUsername,
          password,
          churchAffiliation,
        });
        if (signUpError) {
          setError(toFriendlyAuthError(signUpError.message));
          return;
        }

        const { error: finalSignInError } = await signIn(cleanUsername, password);
        if (finalSignInError) {
          setError(toFriendlyAuthError(finalSignInError.message));
          return;
        }
      }

      localStorage.setItem('lastUsername', cleanUsername);
    } catch (err: any) {
      setError(err?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={
        onClose
          ? 'fixed inset-0 z-[100] bg-black/50 overflow-y-auto overscroll-contain'
          : 'min-h-screen bg-[#faf8f4] flex items-start sm:items-center justify-center px-4'
      }
    >
      <div className={onClose ? 'min-h-full sm:min-h-0 flex items-start sm:items-center justify-center p-0 sm:p-4' : 'w-full flex items-start sm:items-center justify-center py-6 sm:py-0'}>
        <div className="w-full max-w-md bg-[#faf8f4] rounded-none sm:rounded-2xl p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] relative shadow-none sm:shadow-lg">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 text-[#2c1810]/50 hover:text-[#2c1810] transition-colors"
            aria-label="Close sign in"
          >
            <X size={22} />
          </button>
        )}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Book className="text-[#c49a5c]" size={32} />
            <h1 className="text-3xl font-serif text-[#2c1810]">Faith Notebook</h1>
          </div>
          <p className="text-[#2c1810]/60">
            Your personal Bible reading companion with sermon insights
          </p>
        </div>

        <div className="bg-white/60 border border-[#c49a5c]/20 rounded-lg p-8 shadow-lg">
          <div className="flex rounded-lg bg-[#f3eadf] p-1 mb-5">
            <button
              type="button"
              onClick={() => { setMode('sign-in'); setError(''); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'sign-in'
                  ? 'bg-white text-[#2c1810] shadow-sm'
                  : 'text-[#2c1810]/60'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('create-account'); setError(''); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'create-account'
                  ? 'bg-white text-[#2c1810] shadow-sm'
                  : 'text-[#2c1810]/60'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[#2c1810] mb-2">
                Sign-In Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-4 py-2 bg-white border border-[#c49a5c]/30 rounded-lg text-[#2c1810] placeholder-[#2c1810]/40 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50"
                placeholder={mode === 'sign-in' ? 'Enter your username' : 'Choose a username'}
              />
              <p className="text-xs text-[#2c1810]/60 mt-1">
                This is only for signing in. The name other disciples see can be set after you log in.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#2c1810] mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 bg-white border border-[#c49a5c]/30 rounded-lg text-[#2c1810] placeholder-[#2c1810]/40 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50"
                placeholder="••••••••"
              />
              <p className="text-xs text-[#2c1810]/60 mt-1">
                {mode === 'create-account' ? 'At least 6 characters' : 'Enter the password you used before'}
              </p>
            </div>

            {mode === 'create-account' && (
              <div>
                <label htmlFor="church-affiliation" className="block text-sm font-medium text-[#2c1810] mb-2">
                  Church
                </label>
                <select
                  id="church-affiliation"
                  value={churchAffiliation}
                  onChange={(e) => setChurchAffiliation(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-white border border-[#c49a5c]/30 rounded-lg text-[#2c1810] focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50"
                >
                  <option value="">Select your church</option>
                  {CHURCH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#2c1810]/60 mt-1">
                  This helps us keep the app simple and relevant for Florida churches.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#c49a5c] text-white font-medium rounded-lg hover:bg-[#b08a4c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {mode === 'sign-in' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                <span>{mode === 'sign-in' ? 'Continue' : 'Create Account'}</span>
              )}
            </button>
          </form>

          <div className="mt-4 space-y-2 text-xs text-center text-[#2c1810]/60">
            <p>
              {mode === 'sign-in'
                ? 'Sign back in with your same username to keep everything connected.'
                : 'Create your account with the church you are part of, then finish setup after you sign in.'}
            </p>
            <p>
              Add your recovery email after you sign in so this account is ready for safer password recovery.
            </p>
            {mode === 'sign-in' && (
              <button
                type="button"
                onClick={() => setShowRecoveryModal(true)}
                className="text-[#8c6430] hover:text-[#6f4f22] underline underline-offset-2"
              >
                Forgot password?
              </button>
            )}
            <p className="pt-1 text-[#8c6430]">Powered by Tampa Bay ICC</p>
          </div>
        </div>
        </div>
      </div>

      {showRecoveryModal && (
        <RecoverAccountModal
          initialUsername={username}
          onClose={() => setShowRecoveryModal(false)}
          onRecovered={(nextPassword) => {
            setPassword(nextPassword);
            setShowRecoveryModal(false);
            setError('');
          }}
        />
      )}
    </div>
  );
}
