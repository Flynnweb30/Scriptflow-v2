import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { 
  onAuthStateChange, 
  signInWithGooglePopup, 
  signInWithGoogleRedirect,
  getGoogleRedirectResult,
  signOut, 
  resetPassword,
  updateUserProfile,
  getCurrentUser
} from '../lib/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithGoogleRedirect: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (displayName: string, photoURL?: string) => Promise<void>;
  isAuthenticated: boolean;
  userEmail: string | null;
  userName: string | null;
  userPhoto: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Check for redirect result first
    const checkRedirect = async () => {
      try {
        const result = await getGoogleRedirectResult();
        if (result && isMounted) {
          setUser(result.user);
          setLoading(false);
        }
      } catch (error) {
        console.error('Redirect result error:', error);
      }
    };

    checkRedirect();

    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((user) => {
      if (isMounted) {
        setUser(user);
        setLoading(false);
      }
    });

    // Cleanup
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithGooglePopup();
      setUser(result.user);
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        await loginWithGoogleRedirect();
      }
      throw error;
    }
  };

  const loginWithGoogleRedirect = async () => {
    await signInWithGoogleRedirect();
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const resetPasswordHandler = async (email: string) => {
    await resetPassword(email);
  };

  const updateProfileHandler = async (displayName: string, photoURL?: string) => {
    await updateUserProfile(displayName, photoURL);
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser({ ...currentUser });
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    loginWithGoogle,
    loginWithGoogleRedirect,
    logout,
    resetPassword: resetPasswordHandler,
    updateProfile: updateProfileHandler,
    isAuthenticated: !!user,
    userEmail: user?.email || null,
    userName: user?.displayName || user?.email?.split('@')[0] || null,
    userPhoto: user?.photoURL || null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
// Backward-compatible hook export for legacy components.
export const useAuth = useAuthContext;
