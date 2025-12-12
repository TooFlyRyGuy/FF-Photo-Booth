import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, AlertCircle, Chrome } from 'lucide-react';

interface LoginProps {
  onSuccess: () => void;
  onSwitchToSignup: () => void;
  onBackToLanding: () => void;
}

const Login: React.FC<LoginProps> = ({ onSuccess, onSwitchToSignup, onBackToLanding }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border-2 border-slate-300 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <img src="/smaller700x200_logo.png" alt="Fun Frame Photo" className="h-12" />
        </div>

        <div className="flex justify-center mb-6">
          <div className="p-4 bg-green-700/10 rounded-full text-green-800 border border-green-700/20">
            <Lock size={32} />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-black text-center mb-2">Welcome Back</h2>
        <p className="text-slate-600 text-center mb-8">Sign in to your account</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-50 border-2 border-slate-300 text-slate-900 pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-green-700 focus:border-green-700 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border-2 border-slate-300 text-slate-900 pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-green-700 focus:border-green-700 focus:outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-green-700/25 hover:shadow-green-700/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-slate-50 hover:bg-slate-100 border-2 border-slate-300 text-slate-900 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Chrome size={20} />
          Google
        </button>

        <div className="mt-6 text-center space-y-2">
          <p className="text-slate-600 text-sm">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToSignup}
              className="text-green-700 hover:text-green-800 font-medium"
            >
              Sign Up
            </button>
          </p>
          <button
            onClick={onBackToLanding}
            className="text-slate-500 hover:text-slate-700 text-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
