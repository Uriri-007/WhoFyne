'use client';

import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import { Trophy, TrendingUp, Award } from 'lucide-react';
import { PageTransition } from '@/src/components/Navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { LeaderboardSkeleton, Skeleton } from '@/src/components/Skeleton';
import { useAuth } from '@/src/contexts/AuthContext';

interface LeaderboardUser {
  id: string;
  username: string;
  avatarUrl: string;
  totalVotesReceived: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [actualRank, setActualRank] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('isUploader', true)
        .order('totalVotesReceived', { ascending: false })
        .limit(10);
        
      if (!error && data) {
        setLeaderboard(data as LeaderboardUser[]);
      } else if (error) {
        console.error('Error fetching leaderboard:', error.message || error);
      }

      if (profile?.isUploader) {
        const { count, error: countError } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('isUploader', true)
          .gt('totalVotesReceived', profile.totalVotesReceived || 0);

        if (!countError && count !== null) {
          setActualRank(count + 1);
        } else {
          // Fallback to top 10 array if count fails
          const idx = data?.findIndex(u => u.id === profile.id);
          if (idx !== undefined && idx >= 0) setActualRank(idx + 1);
        }
      }

      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel('public:users:leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    votes: u.totalVotesReceived,
    isMe: u.id === profile?.id
  }));

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
              <h2 className="text-5xl font-bold mb-6">{profile?.totalVotesReceived || 0}</h2>
              <div className="flex items-center gap-4 text-sm font-medium">
                <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  <Award className="w-4 h-4" />
                  Rank {actualRank > 0 ? `#${actualRank}` : 'N/A'}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-8 shadow-sm transition-colors">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-neutral-100">
                <Trophy className="w-5 h-5 text-amber-500" />
                Top 10 Performers
              </h3>
              <div className="space-y-4">
                {leaderboard.map((user, idx) => (
                  <div key={user.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img 
                          src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} 
                          alt={user.username} 
                          className="w-10 h-10 rounded-full border border-neutral-100 dark:border-neutral-800 transition-colors" 
                        />
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-sm rounded-full flex items-center justify-center text-[10px] font-bold dark:text-white transition-colors">
                          {idx + 1}
                        </span>
                      </div>
                      <span className={`text-sm font-medium truncate max-w-[100px] sm:max-w-[140px] transition-colors ${user.id === profile?.id ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        {user.username}
                      </span>
                    </div>
                    <span className="text-sm font-mono text-neutral-400 dark:text-neutral-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {user.totalVotesReceived}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Visualization Card */}
          <div className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-4 sm:p-8 shadow-sm h-[600px] flex flex-col transition-colors overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <h3 className="text-lg font-bold flex items-center gap-2 dark:text-neutral-100">
                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Top 10 Live Ranking
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

            <div className="flex-1 w-full min-h-0 overflow-x-auto custom-scrollbar">
              <div className="min-w-[500px] h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart id="vibrance-leaderboard-chart" data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#a3a3a3" strokeOpacity={0.2} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#a3a3a3', fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      dy={10}
                      dx={-5}
                      interval={0}
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
                    <Bar dataKey="votes" radius={[10, 10, 0, 0]} maxBarSize={40}>
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
      </div>
    </PageTransition>
  );
}
