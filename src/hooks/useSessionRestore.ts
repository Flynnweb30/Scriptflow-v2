import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SessionManager from '../utils/session';

export const useSessionRestore = () => {
    const { currentUser, userData, refreshUserData } = useAuth();
    const [restoring, setRestoring] = useState(true);
    const [lastSession, setLastSession] = useState<any>(null);

    useEffect(() => {
        const restoreSession = async () => {
            if (!currentUser) {
                setRestoring(false);
                return;
            }

            try {
                const session = SessionManager.getInstance();
                const sessionData = session.getSession();

                if (sessionData && sessionData.userId === currentUser.uid) {
                    setLastSession(sessionData);
                    
                    // Refresh user data if needed
                    if (userData) {
                        await refreshUserData();
                    }
                }

                // Start new session
                session.startSession(currentUser);
                
            } catch (error) {
                console.warn('Session restore error:', error);
            } finally {
                setRestoring(false);
            }
        };

        restoreSession();
    }, [currentUser]);

    return { restoring, lastSession };
};

export default useSessionRestore;