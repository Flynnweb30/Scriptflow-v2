import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

interface AuthGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
    const { currentUser, loading, initialized } = useAuth();
    const [authModalOpen, setAuthModalOpen] = useState(false);

    if (loading || !initialized) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '200px',
                color: '#94a3b8'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔄</div>
                    <div>Loading session...</div>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                padding: '20px',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔒</div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>Sign In Required</h2>
                <p style={{ margin: '8px 0 24px', fontSize: '16px', color: '#94a3b8', maxWidth: '400px', lineHeight: '1.6' }}>
                    Please sign in to access your scripts, appointments, and team data.
                </p>
                <button
                    onClick={() => setAuthModalOpen(true)}
                    style={{
                        padding: '12px 32px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 4px 16px rgba(37,99,235,0.3)'
                    }}
                    className="hover:opacity-90 hover:scale-[1.02]"
                >
                    <i className="fas fa-sign-in-alt" style={{ marginRight: '8px' }}></i>
                    Sign In
                </button>
                <AuthModal
                    isOpen={authModalOpen}
                    currentUser={currentUser}
                    onClose={() => setAuthModalOpen(false)}
                    onSuccess={() => setAuthModalOpen(false)}
                />
            </div>
        );
    }

    return <>{children}</>;
};

export default AuthGuard;