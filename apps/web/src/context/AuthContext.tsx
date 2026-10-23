import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginRequest } from '@placement-platform/contracts';
import { getMe, login as apiLogin, logout as apiLogout, ApiError } from '../api/auth.js';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  loginError: string | null;
  serverError: string | null;
  isSubmitting: boolean;
  login: (credentials: LoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  retryCheck: () => void;
  clearLoginError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [serverError, setServerError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const initSession = useCallback(async () => {
    setStatus('checking');
    setServerError(null);
    setLoginError(null);

    try {
      const activeUser = await getMe();
      if (activeUser) {
        setUser(activeUser);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    } catch (err) {
      // Distinguish API unavailability from a normal 401 unauthenticated session
      setUser(null);
      setStatus('error');
      setServerError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to the backend server. Please verify the API is running.'
      );
    }
  }, []);

  useEffect(() => {
    void initSession();
  }, [initSession]);

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    setIsSubmitting(true);
    setLoginError(null);

    try {
      const authenticatedUser = await apiLogin(credentials);
      setUser(authenticatedUser);
      setStatus('authenticated');
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        setLoginError(err.message);
      } else {
        setLoginError('An unexpected error occurred during login. Please try again.');
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async (): Promise<void> => {
    await apiLogout();
    setUser(null);
    setStatus('unauthenticated');
    setLoginError(null);
  };

  const clearLoginError = () => {
    setLoginError(null);
  };

  const retryCheck = () => {
    void initSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        loginError,
        serverError,
        isSubmitting,
        login,
        logout,
        retryCheck,
        clearLoginError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
