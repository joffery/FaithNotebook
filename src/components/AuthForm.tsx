import { useState } from 'react';
import { Book } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Single username/password form: if username exists we attempt sign in; if not, we sign up + sign in
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Try signing in first
      const { error: signInError } = await signIn(username, password);
      if (!signInError) {
        // signed in
        setLoading(false);
        return;
      }

      // If sign-in failed, attempt to sign up (this covers new usernames)
      const { error: signUpError } = await signUp(username, password);

      if (signUpError) {
        // likely wrong password for existing user or other problem
        setError(signUpError.message || 'Authentication failed');
        setLoading(false);
        return;
      }

      // After sign up, try sign in to establish session
      const { error: finalSignInError } = await signIn(username, password);
      if (finalSignInError) {
        setError(finalSignInError.message || 'Sign in after sign up failed');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[#2c1810] mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                className="w-full px-4 py-2 bg-white border border-[#c49a5c]/30 rounded-lg text-[#2c1810] placeholder-[#2c1810]/40 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50"
                placeholder="Choose a username"
              />
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
              <p className="text-xs text-[#2c1810]/60 mt-1">At least 6 characters</p>
            </div>

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
                  Signing in...
                </span>
              ) : (
                <span>Continue</span>
              )}
            </button>
          </form>

          <p className="text-xs text-center text-[#2c1810]/60 mt-4">
            If the username is new, an account will be created automatically. No email required.
          </p>
        </div>
      </div>
    </div>
  );
}
