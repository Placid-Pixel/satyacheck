import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { api } from '../api';

interface AuthContextType {
  user: User | null;
  role: Role;
  lang: 'en' | 'hi';
  switchRole: (newRole: Role) => Promise<void>;
  toggleLanguage: () => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_CREDENTIALS: Record<Role, { u: string; p: string }> = {
  SCRUTINY_OFFICER: { u: 'scrutiny_officer', p: 'officer123' },
  INSTITUTION_USER: { u: 'inst_user', p: 'inst123' },
  SENIOR_AUTHORITY: { u: 'senior_authority', p: 'senior123' },
  ADMIN: { u: 'admin_user', p: 'admin123' }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>('SCRUTINY_OFFICER');
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initLogin = async (targetRole: Role) => {
    try {
      setIsLoading(true);
      const creds = ROLE_CREDENTIALS[targetRole];
      const authData = await api.login(creds.u, creds.p);
      const profile = await api.getMe();
      setUser(profile);
      setRole(targetRole);
    } catch (e) {
      console.error("Initial login error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initLogin('SCRUTINY_OFFICER');
  }, []);

  const switchRole = async (newRole: Role) => {
    await initLogin(newRole);
  };

  const toggleLanguage = () => {
    setLang(prev => (prev === 'en' ? 'hi' : 'en'));
  };

  const logout = () => {
    localStorage.removeItem('satyacheck_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, lang, switchRole, toggleLanguage, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
