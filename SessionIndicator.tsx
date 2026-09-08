import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SessionManager from '../utils/session';

export const SessionIndicator: React.FC = () => {
    const { currentUser } = useAuth();
    const [sessionDuration, setSessionDuration] = useState(0);
    const [isValid, setIsValid] = useState(true);

    useEffect(() => {
        const session = SessionManager.getInstance();
        
        const updateSessionInfo = () => {
            const duration = session.getSessionDuration();
            setSessionDuration(duration);
            setIsValid(session.isSessionValid());
        };

        updateSessionInfo();
        const interval = setInterval(updateSessionInfo, 60000);

        return () => clearInterval(interval);
    }, []);

    if (!currentUser) return null;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: '8px',
            background: isValid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${isValid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            fontSize: '11px',
            color: isValid ? '#10b981' : '#ef4444'
        }}>
            <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isValid ? '#10b981' : '#ef4444',
                animation: isValid ? 'pulse 2s infinite' : 'none'
            }} />
            <span>{isValid ? 'Session Active' : 'Session Expired'}</span>
            <span style={{ color: '#64748b' }}>•</span>
            <span>{sessionDuration}m</span>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
};

export default SessionIndicator;