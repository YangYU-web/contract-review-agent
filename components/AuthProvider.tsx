'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { getAuthClient, isAuthConfigured } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDemoMode: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDemoMode: true,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isDemoMode = !isAuthConfigured();

  const refreshUser = async () => {
    const client = getAuthClient();
    if (!client) {
      setLoading(false);
      return;
    }
    const { data } = await client.auth.getUser();
    setUser(data.user);
    setLoading(false);
  };

  useEffect(() => {
    refreshUser();

    // 监听认证状态变化
    const client = getAuthClient();
    if (client) {
      const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });
      return () => {
        listener.subscription.unsubscribe();
      };
    }
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isDemoMode, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
