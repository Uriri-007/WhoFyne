'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User, Mail, Save, LogOut, CheckCircle2, Moon, Sun, Monitor } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/src/contexts/AuthContext';
import { PageTransition } from '@/src/components/Navigation';
import { ProfileSkeleton } from '@/src/components/Skeleton';

export default function Profile() {
  const { user, profile, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('prefer_not_to_say');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setGender(profile.gender || 'prefer_not_to_say');
      setAvatarUrl(profile.avatarUrl || '');
    }
  }, [profile]);

  if (authLoading || !user || !profile) {
    return <ProfileSkeleton />;
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          username,
          gender,
          avatarUrl
        })
        .eq('uid', user.id);

      if (updateError) throw updateError;

      // Update all user's uploads with new username/avatar if they changed
      if (profile.username !== username || profile.avatarUrl !== avatarUrl) {
        try {
          await supabase
            .from('uploads')
            .update({
              uploaderName: username,
              uploaderAvatar: avatarUrl
            })
            .eq('uploaderId', user.id);
        } catch (err: any) {
          console.error("Error updating user's uploads:", err);
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
       console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-32">
        <div className="bg-white dark:bg-neutral-900 rounded-[40px] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden transition-colors">
          <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          
          <div className="px-8 pb-8 -mt-12 text-center">
            <div className="relative inline-block group">
              <img
                src={avatarUrl || user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                alt={username}
                className="w-32 h-32 rounded-full border-4 border-white dark:border-neutral-900 shadow-xl bg-white dark:bg-neutral-900 object-cover backdrop-blur-md transition-colors"
                referrerPolicy="no-referrer"
              />
              <button 
                type="button"
                className="absolute bottom-0 right-0 p-2 bg-white dark:bg-neutral-800 rounded-full shadow-lg border border-neutral-100 dark:border-neutral-700 hover:scale-110 transition-all"
                onClick={() => setAvatarUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`)}
                title="Randomize Avatar"
              >
                <motion.div whileTap={{ rotate: 180 }}>
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </motion.div>
              </button>
            </div>

            <h1 className="mt-6 text-2xl font-bold text-neutral-900 dark:text-neutral-50 transition-colors">{profile.username}</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm flex items-center justify-center gap-1.5 mt-1 transition-colors">
              <Mail className="w-3 h-3" />
              {profile.email}
            </p>

            <form onSubmit={handleUpdate} className="mt-12 space-y-6 text-left max-w-md mx-auto">
              {mounted && (
                <div className="space-y-3 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-2">Theme</label>
                  <div className="flex gap-2 bg-neutral-50 dark:bg-neutral-800/50 p-1 rounded-2xl ring-1 ring-neutral-200 dark:ring-neutral-700/50 transition-colors">
                    {[
                      { id: 'light', icon: Sun, label: 'Light' },
                      { id: 'dark', icon: Moon, label: 'Dark' },
                      { id: 'system', icon: Monitor, label: 'System' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          theme === t.id 
                            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/50 dark:ring-neutral-600' 
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                        }`}
                      >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-5 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-none ring-1 ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-indigo-500 transition-all outline-none dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                  placeholder="CoolUsername123"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-2">Gender Identity</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-5 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-none ring-1 ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-indigo-500 transition-all outline-none appearance-none dark:text-neutral-100"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-2">Avatar URL (Optional)</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-5 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-none ring-1 ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-indigo-500 transition-all outline-none dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                  placeholder="https://example.com/avatar.png"
                />
              </div>

              <div className="pt-6 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 rounded-2xl text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                    saved ? 'bg-green-500 scale-[0.98]' : 'bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700'
                  }`}
                >
                  {saved ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Changes Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {loading ? 'Updating...' : 'Save Settings'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-4 rounded-2xl bg-white dark:bg-transparent border border-neutral-200 dark:border-neutral-700 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
