import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";

interface AdminUser {
  id: string;
  login: string;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
}

interface AuthCtx {
  user: AdminUser | null;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  can: (perm: string) => boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const can = useCallback(
    (perm: string) => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return user.permissions.includes(perm);
    },
    [user]
  );

  useEffect(() => {
    const token = localStorage.getItem("duster_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api<AdminUser>("/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("duster_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (loginName: string, password: string) => {
    const res = await api<{ token: string; admin: AdminUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ login: loginName, password }),
    });
    localStorage.setItem("duster_token", res.token);
    setUser(res.admin);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("duster_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
