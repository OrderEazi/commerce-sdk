import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, setToken, clearToken, getToken } from '../lib/api';
import type { LoginResponse, RegisterRequest } from '../lib/types';

interface AuthUser {
  id: number;
  email: string;
  personId?: number;
  accountId?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<string | void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// The JWT's claims use ASP.NET Core's default outbound claim mapping (ClaimTypes.NameIdentifier -> "nameid",
// see JwtAuthenticationService), plus PersonId/AccountId as custom claims.
function decodeUser(token: string): AuthUser | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));

    const email = payload.email || payload.Email;
    if (!email) return null;

    const id = payload.nameid || payload.sub || payload.NameIdentifier;

    return {
      id: id ? parseInt(id, 10) : 0,
      email,
      personId: payload.PersonId ? parseInt(payload.PersonId, 10) : undefined,
      accountId: payload.AccountId ? parseInt(payload.AccountId, 10) : undefined,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) setUser(decodeUser(token));
    setLoading(false);
  }, []);

  const applyLoginResponse = (response: LoginResponse) => {
    setToken(response.token);
    setUser(decodeUser(response.token));
  };

  const login = async (email: string, password: string) => {
    const response = await auth.login(email, password);
    applyLoginResponse(response);
  };

  const register = async (data: RegisterRequest) => {
    const response = await auth.register(data);
    if ('token' in response && response.token) {
      applyLoginResponse(response as LoginResponse);
      return;
    }
    return (response as { message: string }).message;
  };

  const logout = () => {
    clearToken();
    setUser(null);
    auth.logout().catch(() => {
      // best-effort - token is already cleared client-side regardless
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuth: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
