'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Trophy, TrendingUp, Award } from 'lucide-react';
import { PageTransition } from '@/src/components/Navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { LeaderboardSkeleton, Skeleton } from '@/src/components/Skeleton';
import { getDefaultAvatar, supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

interface LeaderboardUser {
  id: string;
  username: string;
  avatar_url: string | null;
  total_votes_received: number;
}

export default function Dashboard() {
  const { profile, refreshProfile } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, total_votes_received')
      .eq('is_uploader', true)
      .order('total_votes_received', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Failed to load leaderboard:', error);
    } else {
      setLeaderboard((data || []) as LeaderboardUser[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeaderboard();

    // Subscribe to changes in the profiles table for real-time updates
    // We listen to all changes and refetch the leaderboard to ensure accuracy
    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          fetchLeaderboard();

          // If the change was for the current user, refresh their profile to update "Your Impact"
          const changedProfile = payload.new as Partial<LeaderboardUser> | null;
          if (profile?.id && changedProfile?.id === profile.id) {
            refreshProfile();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaderboard, profile?.id, refreshProfile]);

  if (loading) {
    return (
      <PageTransition>
        <div className="max-w-screen-xl mx-auto px-4 pt-8 pb-32">
          <header className="mb-12 space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-48" />
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <Skeleton className="h-48 rounded-3xl" />
              <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-8 shadow-sm">
                <Skeleton className="h-6 w-32 mb-6" />
                <LeaderboardSkeleton />
              </div>
            </div>
            <div className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-8 shadow-sm h-[500px]">
              <Skeleton className="h-full w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  const chartData = leaderboard.map(u => ({
    name: u.username,
    votes: u.total_votes_received,
    isMe: u.id === profile?.id
  }));

  const userRank = profile?.is_uploader ? leaderboard.findIndex(u => u.id === profile?.id) + 1 : 0;

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 pt-8 pb-32">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2 transition-colors">Platform Dashboard</h1>
          <p className="text-neutral-500 dark:text-neutral-400 transition-colors">Live rankings and engagement analytics.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Stats Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-indigo-600 dark:bg-indigo-700/80 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden transition-colors">
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <TrendingUp className="w-48 h-48" />
              </div>
              <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-2">Your Impact</p>
              <h2 className="text-5xl font-bold mb-6">{profile?.total_votes_received || 0}</h2>
              <div className="flex items-center gap-4 text-sm font-medium">
                <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  <Award className="w-4 h-4" />
                  Rank {userRank > 0 ? `#${userRank}` : 'N/A'}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-8 shadow-sm transition-colors">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-neutral-100">
                <Trophy className="w-5 h-5 text-amber-500" />
                Top Performers
              </h3>
              <div className="space-y-4">
                {leaderboard.slice(0, 5).map((user, idx) => (
                  <div key={user.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10">
                        <Image 
                          src={user.avatar_url || getDefaultAvatar(user.id)} 
                          alt={user.username} 
                          fill
                          sizes="40px"
                          className="rounded-full border border-neutral-100 dark:border-neutral-800 transition-colors object-cover" 
                        />
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-sm rounded-full flex items-center justify-center text-[10px] font-bold dark:text-white transition-colors z-10">
                          {idx + 1}
                        </span>
                      </div>
                      <span className={`text-sm font-medium transition-colors ${user.id === profile?.id ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        {user.username}
                      </span>
                    </div>
                    <span className="text-sm font-mono text-neutral-400 dark:text-neutral-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {user.total_votes_received}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Visualization Card */}
          <div className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-8 shadow-sm h-[500px] flex flex-col transition-colors">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold flex items-center gap-2 dark:text-neutral-100">
                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Vibrance Leaderboard
              </h3>
              <div className="flex items-center gap-4 text-xs font-mono text-neutral-400 dark:text-neutral-500 transition-colors">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-indigo-600 dark:bg-indigo-500 rounded-full"></div>
                  <span>Others</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                  <span>You</span>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart id="vibrance-leaderboard-chart" data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#a3a3a3" strokeOpacity={0.2} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a3a3a3', fontSize: 10 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a3a3a3', fontSize: 10 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                    contentStyle={{
                      borderRadius: '16px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: 'var(--tooltip-bg, #fff)',
                      color: 'var(--tooltip-color, #000)'
                    }}
                  />
                  <Bar dataKey="votes" radius={[10, 10, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isMe ? '#fbbf24' : '#4f46e5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
