import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BrandMark } from '../ui/BrandMark';

interface LoginProps {
  onSuccess?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const { loginWithGoogle, loading, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (user && onSuccess) {
      onSuccess();
    }
  }, [user, onSuccess]);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups or try again.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else {
        setError(err.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const { resetPassword } = await import('../../lib/auth');
      await resetPassword(email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#030712] via-[#0a1628] to-[#030712] p-4">
      <div className="w-full max-w-md">
        {/* Main Modal */}
        <div className="relative glass rounded-3xl p-8 md:p-10 border border-slate-800/50 shadow-2xl overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
          
          {/* Content */}
          <div className="relative z-10">
            {/* Logo & Title */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <BrandMark size="lg" className="mb-4 inline-grid animate-pulse" />
                <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight mt-2">
                ScriptFlow Pro
              </h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-slate-400 text-sm">Smart CRM</span>
                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                <span className="text-slate-400 text-sm">Secure</span>
                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                <span className="text-slate-400 text-sm">Professional</span>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 animate-fade-in">
                <p className="text-red-400 text-sm flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                  {error}
                </p>
              </div>
            )}

            {/* Reset Password Success */}
            {resetSent && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 animate-fade-in">
                <p className="text-green-400 text-sm flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-400 mt-0.5 shrink-0" />
                  Password reset email sent! Check your inbox.
                </p>
              </div>
            )}

            {/* PROMINENT GOOGLE SIGN-IN BUTTON */}
            <div className="mb-4">
              <button
                onClick={handleGoogleLogin}
                disabled={isSubmitting || loading}
                className={`
                  w-full py-4 px-6 rounded-xl font-semibold text-base
                  transition-all duration-300 ease-out
                  flex items-center justify-center gap-3
                  relative overflow-hidden
                  ${isSubmitting || loading 
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]'
                  }
                  bg-white text-gray-800 border-2 border-white
                  shadow-lg
                `}
                style={{
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 40px rgba(59, 130, 246, 0.1)',
                }}
              >
                {/* Animated gradient background on hover */}
                <span className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'linear-gradient(135deg, #4285f4 0%, #ea4335 25%, #fbbc05 50%, #34a853 75%, #4285f4 100%)',
                    backgroundSize: '300% 300%',
                    animation: 'gradientMove 3s ease infinite',
                  }}
                ></span>
                
                {/* Google Icon - Large and clear */}
                <svg className="w-6 h-6 flex-shrink-0 relative z-10" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                
                <span className="relative z-10 font-medium">
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>Continue with Google</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  )}
                </span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700/50"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-[#0a1628] text-xs text-slate-500 uppercase tracking-wider">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Email Login Toggle */}
            <button
              onClick={() => setShowEmailForm(!showEmailForm)}
              className="w-full py-3 px-4 bg-slate-800/30 hover:bg-slate-700/30 text-slate-300 font-medium rounded-xl transition-all duration-200 border border-slate-700/30 hover:border-slate-600/50 flex items-center justify-center gap-2 group"
            >
              <svg className={`w-4 h-4 transition-transform duration-200 ${showEmailForm ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showEmailForm ? 'Back to Google Sign-In' : 'Sign in with Email'}
            </button>

            {/* Email Login Form */}
            {showEmailForm && (
              <div className="mt-4 space-y-4 animate-fade-in">
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      disabled={isSubmitting}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </form>
                <p className="text-xs text-slate-500 text-center">
                  Enter your email to receive a password reset link
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-slate-800/50">
              <p className="text-xs text-slate-500 text-center">
                By continuing, you agree to our{' '}
                <button className="text-blue-400 hover:text-blue-300 transition-colors">
                  Terms of Service
                </button>
                {' '}and{' '}
                <button className="text-blue-400 hover:text-blue-300 transition-colors">
                  Privacy Policy
                </button>
              </p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <span className="w-1 h-1 bg-green-400 rounded-full inline-block animate-pulse"></span>
                  Secure
                </span>
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  🔒 256-bit
                </span>
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  ⚡ Firebase
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add keyframe animation for gradient */}
      <style>{`
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
};

export default Login;