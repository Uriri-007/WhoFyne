'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';

import Image from 'next/image';
import { Share2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { CardSkeleton } from '@/src/components/Skeleton';
import { motion } from 'motion/react';
import { useAuth } from '@/src/contexts/AuthContext';
import { PageTransition } from '@/src/components/Navigation';

interface Upload {
  id: string;
  uploaderId: string;
  uploader: {
    username: string;
    avatarUrl: string;
  };
  imageUrl: string;
  title: string;
  upvotes: number;
  downvotes: number;
  totalVotes: number;
  createdAt: string;
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  const observer = useRef<IntersectionObserver | null>(null);

  // Fetch user's votes
  useEffect(() => {
    if (!user) {
      setUserVotes({});
      return;
    }

    const fetchVotes = async () => {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('userId', user.id);
        
      if (!error && data) {
        const votes: Record<string, 'up' | 'down'> = {};
        data.forEach(vote => {
          votes[vote.uploadId] = vote.type;
        });
        setUserVotes(votes);
      }
    };
    
    fetchVotes();

    const channel = supabase
      .channel('public:votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `userId=eq.${user.id}` }, (payload) => {
        // Just refetch or process payload to be safe
        fetchVotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchUploads = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      const { data, error, count } = await supabase
        .from('uploads')
        .select('*, uploader:users(username, avatarUrl)', { count: 'exact' })
        .order('createdAt', { ascending: false })
        .range(page * 10, (page + 1) * 10 - 1);

      if (error) throw new Error(error.message || JSON.stringify(error));

      if (!data || data.length === 0) {
        setHasMore(false);
      } else {
        const newUploads = data as Upload[];
        setUploads(prev => {
          const existingIds = new Set(prev.map(u => u.id));
          const filteredNew = newUploads.filter(u => !existingIds.has(u.id));
          return [...prev, ...filteredNew];
        });
        setPage(p => p + 1);
        
        if (count !== null && uploads.length + newUploads.length >= count) {
           setHasMore(false);
        }
      }
    } catch (error: any) {
      console.error('Error fetching uploads:', error.message || error);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, uploads.length]);

  useEffect(() => {
    fetchUploads();
  }, []);

  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchUploads();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, fetchUploads]);

  const handleVote = async (uploadId: string, type: 'up' | 'down') => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (userVotes[uploadId] || votingIds.has(uploadId)) {
      return; // Already voted or voting in progress
    }

    setVotingIds(prev => new Set(prev).add(uploadId));

    // 1. Optimistic UI Update
    const originalUploads = [...uploads];
    setUploads(prev => prev.map(u => 
      u.id === uploadId 
        ? { 
            ...u, 
            upvotes: type === 'up' ? u.upvotes + 1 : u.upvotes, 
            downvotes: type === 'down' ? u.downvotes + 1 : u.downvotes,
            totalVotes: u.totalVotes + (type === 'up' ? 1 : -1)
          } 
        : u
    ));

    try {
      const voteId = `${user.id}_${uploadId}`;
      const upload = originalUploads.find(u => u.id === uploadId);

      if (!upload) throw new Error('Upload not found.');

      if (upload.uploaderId === user.id) {
        throw new Error('You cannot vote for your own upload.');
      }

      // Check if already voted server-side
      const { data: existingVote } = await supabase
        .from('votes')
        .select('*')
        .eq('userId', user.id)
        .eq('uploadId', uploadId)
        .single();
        
      if (existingVote) {
        throw new Error('You have already voted on this image.');
      }

      // Using an RPC function would be best, but doing it in sequential steps due to simple setup
      // Note: In production this should be a stored procedure or transaction!
      const { error: insertError } = await supabase
        .from('votes')
        .insert([{
          id: voteId,
          userId: user.id,
          uploadId,
          type,
          createdAt: new Date().toISOString()
        }]);

      if (insertError) throw insertError;

      // Update counts using Postgres RPC or straightforward update if we assume no huge concurrency
       const newUpvotes = type === 'up' ? upload.upvotes + 1 : upload.upvotes;
       const newDownvotes = type === 'down' ? upload.downvotes + 1 : upload.downvotes;
       const newTotal = newUpvotes - newDownvotes;

       await supabase
         .from('uploads')
         .update({
           upvotes: newUpvotes,
           downvotes: newDownvotes,
           totalVotes: newTotal
         })
         .eq('id', uploadId);

       // Update uploader's total count
       const { data: uploaderDoc } = await supabase
         .from('users')
         .select('totalVotesReceived')
         .eq('id', upload.uploaderId)
         .single();
         
       if (uploaderDoc) {
          const currentTotal = uploaderDoc.totalVotesReceived || 0;
          await supabase
            .from('users')
            .update({
              totalVotesReceived: currentTotal + (type === 'up' ? 1 : -1)
            })
            .eq('id', upload.uploaderId);
       }

    } catch (error: any) {
      // 2. Revert on Error
      setUploads(originalUploads);
      
      if (error.message?.includes('already voted') || error.message?.includes('own upload')) {
        alert(error.message);
      } else {
        console.error('Voting error:', error);
      }
    } finally {
      setVotingIds(prev => {
        const next = new Set(prev);
        next.delete(uploadId);
        return next;
      });
    }
  };

  const handleShare = async (upload: Upload) => {
    const url = `${window.location.origin}/upload/${upload.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${upload.title || 'Untitled Capture'} • Whofyne`,
          text: `Check out this capture by ${upload.uploader?.username || 'a curator'} on WhoFyne gallery! It has ${upload.totalVotes} votes.`,
          url
        });
      } catch (error: any) {
        if (error.name !== 'AbortError' && error.message !== 'Share canceled') {
          console.error('Error sharing:', error);
        }
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 pt-8 pb-32">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-4 transition-colors">
            WhoFyne <span className="text-indigo-600 dark:text-indigo-400">Gallery</span>
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto transition-colors">
            Discover and vote for the most vibrant captures curated by our community.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {uploads.map((upload, index) => (
            <motion.div
              layout
              key={upload.id}
              ref={index === uploads.length - 1 ? lastElementRef : null}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index % 6 * 0.1 }}
              className="group relative bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-xl transition-all duration-500"
            >
              <div className="aspect-[4/5] overflow-hidden bg-neutral-100 dark:bg-neutral-800 relative">
                <Image
                  src={upload.imageUrl || "https://picsum.photos/seed/placeholder/400/500"}
                  alt={upload.title || 'Upload'}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority={index < 3}
                  referrerPolicy="no-referrer"
                />
                
                {/* Uploader Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 pr-3 py-1 pl-1 bg-black/40 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/20 z-10 transition-colors">
                   <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20 relative bg-neutral-800">
                    <img 
                      src={upload.uploader?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${upload.uploaderId}`} 
                      alt={upload.uploader?.username || 'Uploader'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span>{upload.uploader?.username || 'Curator'}</span>
                </div>

                {/* Share Button */}
                <button
                  onClick={() => handleShare(upload)}
                  className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors border border-white/20"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                {/* Info Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-white font-semibold text-lg">{upload.title || 'Untitled'}</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-white/90 font-mono text-sm">
                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                        {upload.totalVotes} Votes
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => !userVotes[upload.id] && !votingIds.has(upload.id) && handleVote(upload.id, 'up')}
                      className={`p-3 rounded-2xl transition-all active:scale-90 shadow-lg ${
                        userVotes[upload.id] === 'up'
                          ? 'bg-indigo-600 text-white'
                          : (userVotes[upload.id] || votingIds.has(upload.id))
                            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-50'
                            : 'bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                      }`}
                      disabled={!!userVotes[upload.id] || votingIds.has(upload.id)}
                      title={userVotes[upload.id] ? "Already Voted" : (votingIds.has(upload.id) ? "Voting..." : "Upvote")}
                    >
                      <ThumbsUp className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => !userVotes[upload.id] && !votingIds.has(upload.id) && handleVote(upload.id, 'down')}
                      className={`p-3 rounded-2xl transition-all active:scale-95 shadow-lg ${
                        userVotes[upload.id] === 'down'
                          ? 'bg-indigo-600 text-white'
                          : (userVotes[upload.id] || votingIds.has(upload.id))
                            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-50'
                            : 'bg-neutral-900 dark:bg-neutral-950 border border-white/10 dark:border-white/5 hover:bg-neutral-800 dark:hover:bg-neutral-900 text-white dark:text-neutral-300'
                      }`}
                      disabled={!!userVotes[upload.id] || votingIds.has(upload.id)}
                      title={userVotes[upload.id] ? "Already Voted" : (votingIds.has(upload.id) ? "Voting..." : "Downvote")}
                    >
                      <ThumbsDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center mt-12">
            <div className="w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}

        {!hasMore && uploads.length > 0 && (
          <div className="text-center mt-12 py-8 border-t border-neutral-100 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 font-mono text-sm tracking-widest uppercase transition-colors">
            YOU'VE REACHED THE HORIZON
          </div>
        )}

        {!loading && uploads.length === 0 && (
          <div className="text-center py-24 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-700 transition-colors">
            <p className="text-neutral-400 dark:text-neutral-500">No images have been uploaded yet.</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
