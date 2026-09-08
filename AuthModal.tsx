import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { AuthService } from '../services/AuthService';
import { X } from 'lucide-react';
import { BrandMark } from './ui/BrandMark';

interface AuthModalProps {
    isOpen: boolean;
    currentUser: User | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, currentUser, onClose, onSuccess }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [resetSent, setResetSent] = useState(false);

    // Handle ESC key to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        setResetSent(false);
        try {
            await AuthService.signInWithGoogle(rememberMe);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.warn('Google sign in error:', err);
            setError(err.message || 'Failed to sign in with Google');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                await AuthService.signUpWithEmail(email, password, rememberMe);
            } else {
                await AuthService.signInWithEmail(email, password, rememberMe);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            console.warn('Email auth error:', err);
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email.trim()) {
            setError('Enter your email first so we know where to send the reset link.');
            return;
        }
        setLoading(true);
        setError(null);
        setResetSent(false);
        try {
            await AuthService.resetPassword(email);
            setResetSent(true);
        } catch (err: any) {
            setError(err.message || 'Unable to send the password reset email.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        setLoading(true);
        try {
            await AuthService.logout();
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to sign out');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div 
            className="auth-overlay" 
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(4, 8, 19, 0.82)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                padding: '24px',
                animation: 'fadeIn 0.25s ease-out'
            }}
        >
            <div style={{
                width: 'min(440px, 100%)',
                maxHeight: '90vh',
                background: '#0d1527',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative'
            }}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#64748b',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        zIndex: 10
                    }}
                    className="hover:bg-slate-700/50 hover:text-white"
                >
                    <X size={14} aria-hidden="true" />
                </button>

                {/* Header */}
                <div style={{
                    padding: '32px 32px 8px',
                    textAlign: 'center'
                }}>
                    <BrandMark size="lg" className="mx-auto mb-4" />
                    <h2 style={{
                        margin: 0,
                        fontSize: '22px',
                        fontWeight: 800,
                        color: '#f8fafc',
                        letterSpacing: '-0.02em'
                    }}>
                        {currentUser ? 'Account' : isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    <p style={{
                        margin: '6px 0 0',
                        fontSize: '14px',
                        color: '#94a3b8'
                    }}>
                        {currentUser 
                            ? 'Manage your session and preferences' 
                            : isSignUp 
                                ? 'Start collaborating with your team in real-time'
                                : 'Sign in to access your scripts and appointments'
                        }
                    </p>
                </div>

                {/* Body */}
                <div style={{ padding: '24px 32px 32px' }}>
                    {currentUser ? (
                        // Logged In View
                        <>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                padding: '16px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                marginBottom: '20px'
                            }}>
                                {currentUser.photoURL ? (
                                    <img 
                                        src={currentUser.photoURL} 
                                        alt={currentUser.displayName || 'User'} 
                                        style={{ 
                                            width: '48px', 
                                            height: '48px', 
                                            borderRadius: '50%', 
                                            border: '2px solid #3b82f6',
                                            objectFit: 'cover'
                                        }}
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                                        display: 'grid',
                                        placeItems: 'center',
                                        color: '#fff',
                                        fontSize: '20px',
                                        fontWeight: 800
                                    }}>
                                        {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                                        {currentUser.displayName || 'Active Agent'}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                                        {currentUser.email}
                                    </div>
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        marginTop: '4px',
                                        fontSize: '11px',
                                        background: 'rgba(16,185,129,0.12)',
                                        color: '#10b981',
                                        padding: '1px 10px',
                                        borderRadius: '10px',
                                        fontWeight: 600
                                    }}>
                                        <i className="fas fa-check-circle" style={{ fontSize: '9px' }}></i>
                                        <span>Authenticated</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '10px'
                            }}>
                                <button
                                    onClick={handleSignOut}
                                    disabled={loading}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '10px',
                                        background: 'rgba(239,68,68,0.1)',
                                        border: '1px solid rgba(239,68,68,0.2)',
                                        color: '#ef4444',
                                        fontWeight: 700,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.15s ease'
                                    }}
                                    className="hover:bg-red-500/10 hover:border-red-500/30"
                                >
                                    <i className="fas fa-sign-out-alt"></i>
                                    <span>{loading ? '...' : 'Sign Out'}</span>
                                </button>
                                <button
                                    onClick={onClose}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                                        color: '#fff',
                                        fontWeight: 700,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                    className="hover:opacity-90"
                                >
                                    Done
                                </button>
                            </div>

                            <div style={{
                                marginTop: '16px',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.04)',
                                fontSize: '11px',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <i className="fas fa-shield-alt" style={{ color: '#3b82f6', fontSize: '12px' }}></i>
                                <span>Session active • {new Date().toLocaleString()}</span>
                            </div>
                        </>
                    ) : (
                        // Login/Sign Up View
                        <>
                            {error && (
                                <div style={{
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.15)',
                                    color: '#ef4444',
                                    fontSize: '12px',
                                    marginBottom: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    animation: 'fadeIn 0.2s ease'
                                }}>
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Google Sign In */}
                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    padding: '12px 20px',
                                    borderRadius: '12px',
                                    background: '#ffffff',
                                    color: '#1f2937',
                                    border: '1px solid #e5e7eb',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                }}
                                className="hover:shadow-md hover:scale-[1.01] active:scale-[0.98]"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                </svg>
                                <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
                            </button>

                            {/* Divider */}
                            <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0', gap: '12px' }}>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>OR</span>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                            </div>

                            {/* Auth Tabs */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '4px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '10px',
                                padding: '4px',
                                marginBottom: '16px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp(false)}
                                    style={{
                                        padding: '8px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: !isSignUp ? '#2563eb' : 'transparent',
                                        color: !isSignUp ? '#fff' : '#64748b',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp(true)}
                                    style={{
                                        padding: '8px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: isSignUp ? '#2563eb' : 'transparent',
                                        color: isSignUp ? '#fff' : '#64748b',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    Register
                                </button>
                            </div>

                            {/* Email/Password Form */}
                            {resetSent && (
                                <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', color: '#10b981', fontSize: '12px', marginBottom: '16px' }}>
                                    Password reset email sent. Check your inbox and follow the link to continue.
                                </div>
                            )}
                            <form onSubmit={handleEmailAuth}>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ 
                                        display: 'block', 
                                        fontSize: '12px', 
                                        fontWeight: 700, 
                                        marginBottom: '6px', 
                                        color: '#94a3b8',
                                        letterSpacing: '0.02em'
                                    }}>
                                        Email Address
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <i className="far fa-envelope" style={{
                                            position: 'absolute',
                                            left: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: '#475569',
                                            fontSize: '14px'
                                        }}></i>
                                        <input
                                            type="email"
                                            placeholder="agent@scriptflow.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            style={{
                                                width: '100%',
                                                height: '44px',
                                                padding: '0 14px 0 38px',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.03)',
                                                color: '#f8fafc',
                                                outline: 'none',
                                                fontSize: '14px',
                                                transition: 'border-color 0.15s ease'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '18px' }}>
                                    <label style={{ 
                                        display: 'block', 
                                        fontSize: '12px', 
                                        fontWeight: 700, 
                                        marginBottom: '6px', 
                                        color: '#94a3b8',
                                        letterSpacing: '0.02em'
                                    }}>
                                        Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <i className="fas fa-lock" style={{
                                            position: 'absolute',
                                            left: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: '#475569',
                                            fontSize: '14px'
                                        }}></i>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            style={{
                                                width: '100%',
                                                height: '44px',
                                                padding: '0 44px 0 38px',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.03)',
                                                color: '#f8fafc',
                                                outline: 'none',
                                                fontSize: '14px',
                                                transition: 'border-color 0.15s ease'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{
                                                position: 'absolute',
                                                right: '12px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                border: 'none',
                                                background: 'transparent',
                                                color: '#475569',
                                                cursor: 'pointer',
                                                padding: '4px'
                                            }}
                                        >
                                            <i className={`fas fa-${showPassword ? 'eye' : 'eye-slash'}`}></i>
                                        </button>
                                    </div>
                                </div>

                                {!isSignUp && (
                                <button type="button" onClick={handleResetPassword} disabled={loading} style={{ width: '100%', marginTop: '4px', marginBottom: '10px', border: 0, background: 'transparent', color: '#60a5fa', fontSize: '12px', textAlign: 'right', cursor: loading ? 'not-allowed' : 'pointer' }}>
                                    Forgot password?
                                </button>
                            )}

                            {/* Remember Me */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '18px'
                                }}>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '12px',
                                        color: '#94a3b8',
                                        cursor: 'pointer'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            style={{
                                                accentColor: '#2563eb',
                                                width: '16px',
                                                height: '16px',
                                                cursor: 'pointer'
                                            }}
                                        />
                                        <span>Remember me</span>
                                    </label>
                                    {!isSignUp && (
                                        <button
                                            type="button"
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                color: '#3b82f6',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                            className="hover:opacity-80"
                                        >
                                            Forgot password?
                                        </button>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        height: '48px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                                        color: '#fff',
                                        fontWeight: 700,
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        transition: 'all 0.15s ease',
                                        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.3)'
                                    }}
                                    className="hover:opacity-90 hover:shadow-lg"
                                >
                                    {loading ? (
                                        <i className="fas fa-spinner fa-spin"></i>
                                    ) : (
                                        <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                                    )}
                                </button>
                            </form>

                            <div style={{
                                marginTop: '16px',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.04)',
                                fontSize: '11px',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <i className="fas fa-shield-alt" style={{ color: '#3b82f6', fontSize: '12px' }}></i>
                                <span>Your data is encrypted and secure. Powered by Firebase.</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthModal;