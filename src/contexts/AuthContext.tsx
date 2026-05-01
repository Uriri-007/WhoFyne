import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  uid: string;
  username: string;
  email: string;
  avatarUrl: string;
  gender: string;
  isUploader: boolean;
  totalVotesReceived: number;
  themePreference: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isWhitelisted: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);

  useEffect(() => {
    let profileSubscription: any = null;
    let whitelistSubscription: any = null;

    const fetchProfileAndWhitelist = async (currentUser: User) => {
      try {
        // Fetch profile
        let { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (profileError || !profileData) {
          if (profileError && profileError.code !== 'PGRST116') {
             console.error('Error fetching profile:', profileError);
          }
          // Profile doesn't exist, create it
          const email = currentUser.email || '';
          const newProfile = {
            id: currentUser.id,
            uid: currentUser.id,
            username: currentUser.user_metadata?.full_name || email.split('@')[0] || 'User',
            email: email,
            avatarUrl: currentUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`,
            gender: 'prefer_not_to_say',
            isUploader: false,
            totalVotesReceived: 0,
            themePreference: 'system',
            createdAt: new Date().toISOString()
          };
          
          const { data: createdProfile, error: insertError } = await supabase
            .from('users')
            .insert([newProfile])
            .select()
            .single();

          if (!insertError && createdProfile) {
            profileData = createdProfile;
          } else {
            console.error('Error creating profile:', insertError);
            profileData = newProfile; // Fallback for UI if insert fails (e.g. RLS issues)
          }
        }
        
        setProfile((profileData as UserProfile) || null);

        // Fetch whitelist
        let whitelisted = false;
        const isAdminEmail = (email: string | null | undefined) => 
          email === 'okhaiuri@gmail.com' || 
          email === 'ogboumahokhai@gmail.com' || 
          email?.includes('admin');
        
        if (currentUser.email) {
          const { data: whitelistData } = await supabase
            .from('whitelist')
            .select('email')
            .eq('email', currentUser.email)
            .single();

          if (whitelistData || isAdminEmail(currentUser.email)) {
            whitelisted = true;
          }

          if (whitelisted && profileData && !profileData.isUploader) {
            await supabase
              .from('users')
              .update({ isUploader: true })
              .eq('id', currentUser.id);
            
            setProfile(prev => prev ? { ...prev, isUploader: true } : null);
          }

          if (!whitelistData && isAdminEmail(currentUser.email)) {
            await supabase
              .from('whitelist')
              .insert([{ email: currentUser.email }]);
          }
        }
        setIsWhitelisted(whitelisted);

      } catch (error) {
        console.error('Error in fetchProfileAndWhitelist:', error);
        // Fallback to minimal profile if everything fails so UI doesn't hang
        setProfile({
          id: currentUser.id,
          uid: currentUser.id,
          username: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User',
          email: currentUser.email || '',
          avatarUrl: currentUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`,
          gender: 'prefer_not_to_say',
          isUploader: false,
          totalVotesReceived: 0,
          createdAt: new Date().toISOString()
        } as any);
      }
    };

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error.message);
          if (error.message.includes("Refresh Token Not Found") || error.message.includes("Invalid Refresh Token")) {
             // Clear the broken session
             await supabase.auth.signOut();
          }
        }

        const currentUser = data?.session?.user || null;
        
        if (currentUser) {
          setUser(currentUser);
          await fetchProfileAndWhitelist(currentUser);

          // Subscriptions
          profileSubscription = supabase
            .channel(`public:users:${currentUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${currentUser.id}` }, (payload) => {
              if (payload.new) {
                setProfile(payload.new as UserProfile);
              }
            })
            .subscribe();
            
          if (currentUser.email) {
            whitelistSubscription = supabase
              .channel('public:whitelist')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'whitelist', filter: `email=eq.${currentUser.email}` }, (payload) => {
                if (payload.new) {
                  setIsWhitelisted(true);
                }
              })
              .subscribe();
          }
        } else {
          setUser(null);
          setProfile(null);
          setIsWhitelisted(false);
        }
      } catch (err: any) {
        console.error("Auth initialization error:", err);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
    
    const handleFocus = () => {
      // Re-verify session on window focus if we are possibly stale or if auth is missing
      if (!user && !loading) {
         supabase.auth.getSession().then(({ data }) => {
           if (data?.session?.user) {
             initializeAuth();
           }
         });
      }
    };

    window.addEventListener('focus', handleFocus);

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user || null;
      
      if (event === 'SIGNED_IN' && currentUser) {
        // If we already have a user and profile, don't set loading to true again to avoid flicker/stuck states
        if (!user || !profile) {
          setLoading(true);
          setUser(currentUser);
          await fetchProfileAndWhitelist(currentUser);
          setLoading(false);
        } else {
          setUser(currentUser);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsWhitelisted(false);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        setUser(currentUser);
      }
    });

    return () => {
      authListener.unsubscribe();
      window.removeEventListener('focus', handleFocus);
      if (profileSubscription) supabase.removeChannel(profileSubscription);
      if (whitelistSubscription) supabase.removeChannel(whitelistSubscription);
    };
  }, []);
  
  const loginWithGoogle = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        }
      });
      // Will redirect
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isWhitelisted, loginWithGoogle, logout }}>
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

