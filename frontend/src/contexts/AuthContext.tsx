import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  User
} from 'firebase/auth';
import { app } from '@/lib/firebase';

const GUEST_STORAGE_KEY = 'arohan_guest_mode';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isGuest: boolean;
  continueAsGuest: () => void;
  exitGuest: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  isEmailVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(GUEST_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // Real user signed in, clear guest mode
        setIsGuest(false);
        try {
          sessionStorage.removeItem(GUEST_STORAGE_KEY);
        } catch (e) {
          console.warn('Failed to clear guest session:', e);
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [auth]);

  const continueAsGuest = () => {
    try {
      sessionStorage.setItem(GUEST_STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('Failed to save guest session:', e);
    }
    setIsGuest(true);
  };

  const exitGuest = () => {
    try {
      sessionStorage.removeItem(GUEST_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear guest session:', e);
    }
    setIsGuest(false);
  };

  const login = async (email: string, password: string) => {
    exitGuest();
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string) => {
    exitGuest();
    return await createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    exitGuest();
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const sendVerificationEmail = async () => {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
    } else {
      throw new Error('No user is currently logged in');
    }
  };

  const isEmailVerified = currentUser?.emailVerified ?? false;

  const value: AuthContextType = {
    currentUser,
    loading,
    isGuest,
    continueAsGuest,
    exitGuest,
    login,
    signup,
    logout,
    resetPassword,
    sendVerificationEmail,
    isEmailVerified
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
