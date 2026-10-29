import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api from './api';
import { safeLocal } from './storage';

interface User {
  id: string;
  display_name: string;
  email: string;
  phone?: string;
  role: string;
  native_dialect?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { display_name: string; email: string; phone?: string; password: string; native_dialect?: string }) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(safeLocal.get('token'));
  const [loading, setLoading] = useState(true);

  const remember = (u: User) => {
    safeLocal.set('user', JSON.stringify(u));
    setUser(u);
  };

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then((res) => remember(res.data))
        .catch((err) => {
          // No connection: carry on as the user we last saw, so recording works offline.
          const cached = !err?.response && safeLocal.get('user');
          if (cached) return setUser(JSON.parse(cached));
          safeLocal.remove('token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  // Stores the token and loads the user before resolving, so the next page
  // already sees the signed-in user.
  const adopt = async (access_token: string) => {
    safeLocal.set('token', access_token);
    const me = await api.get('/auth/me');
    remember(me.data);
    setToken(access_token);
  };

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    await adopt(res.data.access_token);
  };

  const loginWithGoogle = async (credential: string) => {
    const res = await api.post('/auth/google', { credential });
    await adopt(res.data.access_token);
  };

  const register = async (data: { display_name: string; email: string; phone?: string; password: string; native_dialect?: string }) => {
    const res = await api.post('/auth/register', data);
    await adopt(res.data.access_token);
  };

  const refreshUser = async () => {
    const res = await api.get('/auth/me');
    remember(res.data);
  };

  const logout = () => {
    safeLocal.remove('token');
    safeLocal.remove('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginWithGoogle, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Sends signed-out visitors to the login page, then back here afterwards. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="flex justify-center py-24"><span className="h-8 w-8 animate-spin rounded-full border-[3px] border-saffron-500 border-t-transparent" /></div>;
  }
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
