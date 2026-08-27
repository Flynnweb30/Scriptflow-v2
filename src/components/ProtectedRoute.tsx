import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, fallback }) => {
    const { currentUser, loading, initialized } = useAuth();

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
        return fallback ? <>{fallback}</> : null;
    }

    return <>{children}</>;
};

export default ProtectedRoute;