'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, type Profile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isWhitelisted: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isAdminEmail(email?: string | null) {
  const normalized = email?.toLowerCase();
  return normalized === 'okhaiuri@gmail.com' || normalized === 'ogboumahokhai@gmail.com';
}

async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

async function getWhitelistStatus(user: User, profile: Profile | null) {
  if (profile?.is_uploader || isAdminEmail(user.email)) {
    return true;
  }

  if (!user.email) {
    return false;
  }

  const { data, error } = await supabase
    .from('whitelist')
    .select('email')
    .eq('email', user.email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);

  const loadUser = async (nextUser: User | null) => {
    setUser(nextUser);

    if (!nextUser) {
      setProfile(null);
      setIsWhitelisted(false);
      setLoading(false);
      return;
    }

    try {
      const nextProfile = await getProfile(nextUser.id);
      const whitelisted = await getWhitelistStatus(nextUser, nextProfile);

      setProfile(nextProfile);
      setIsWhitelisted(whitelisted);
    } catch (error) {
      console.error('Supabase auth/profile error:', error);
      setProfile(null);
      setIsWhitelisted(isAdminEmail(nextUser.email));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        loadUser(data.session?.user ?? null);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (isMounted) {
          loadUser(session?.user ?? null);
        }
      }, 0);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        throw error;
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;

    const nextProfile = await getProfile(user.id);
    setProfile(nextProfile);
    setIsWhitelisted(await getWhitelistStatus(user, nextProfile));
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isWhitelisted, loginWithGoogle, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
