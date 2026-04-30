'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import Image from 'next/image';
import { Share2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { motion } from 'motion/react';
import { getDefaultAvatar, supabase, type UploadRow } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { PageTransition } from '@/src/components/Navigation';

interface Upload {
  id: string;
  uploaderId: string;
  uploaderName: string;
  uploaderAvatar?: string | null;
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
  const [lastCreatedAt, setLastCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  const observer = useRef<IntersectionObserver | null>(null);

  const mapUpload = (row: UploadRow): Upload => ({
    id: row.id,
    uploaderId: row.uploader_id,
    uploaderName: row.profiles?.username || 'Unknown curator',
    uploaderAvatar: row.profiles?.avatar_url,
    imageUrl: row.image_url,
    title: row.title,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    totalVotes: row.total_votes,
    createdAt: row.created_at,
  });

  useEffect(() => {
    if (!user) {
      setUserVotes({});
      return;
    }

    const currentUser = user;
    let active = true;

    async function fetchUserVotes() {
      const { data, error } = await supabase
        .from('votes')
        .select('upload_id, type')
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Failed to fetch votes:', error);
        return;
      }

      if (!active) return;

      const votes: Record<string, 'up' | 'down'> = {};
      data.forEach(vote => {
        votes[vote.upload_id] = vote.type;
      });
      setUserVotes(votes);
    }

    fetchUserVotes();

    return () => {
      active = false;
    };
  }, [user]);

  const fetchUploads = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      let request = supabase
        .from('uploads')
        .select('*, profiles!uploads_uploader_id_fkey(username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (lastCreatedAt) {
        request = request.lt('created_at', lastCreatedAt);
      }

      const { data, error } = await request;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        setHasMore(false);
      } else {
        const newUploads = (data as UploadRow[]).map(mapUpload);
        setUploads(prev => {
          const existingIds = new Set(prev.map(u => u.id));
          const filteredNew = newUploads.filter(u => !existingIds.has(u.id));
          return [...prev, ...filteredNew];
        });
        setLastCreatedAt(newUploads[newUploads.length - 1].createdAt);
      }
    } catch (error) {
      console.error('Failed to fetch uploads:', error);
    } finally {
      setLoading(false);
    }
  }, [lastCreatedAt, loading, hasMore]);

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
      const { error } = await supabase
        .from('votes')
        .insert({
          user_id: user.id,
          upload_id: uploadId,
          type,
        });

      if (error) {
        throw error;
      }

      setUserVotes(prev => ({ ...prev, [uploadId]: type }));

    } catch (error: any) {
      // 2. Revert on Error
      setUploads(originalUploads);
      
      // Don't alert for common errors that might be expected (like already voted)
      if (error.message.includes('already voted') || error.message.includes('own upload')) {
        alert(error.message);
      } else {
        console.error('Voting error:', error);
        alert(error.message || 'Unable to cast vote. Please try again.');
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
          title: `WhoFyne • ${upload.title || 'Untitled'}`,
          text: `Check out ${upload.title || 'this masterpiece'} by curator ${upload.uploaderName} with ${upload.totalVotes} votes on WhoFyne!`,
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
                  src={upload.imageUrl}
                  alt={upload.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority={index < 3}
                  referrerPolicy="no-referrer"
                />
                
                {/* Uploader Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 pr-3 py-1 pl-1 bg-black/40 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/20 z-10 transition-colors">
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20 relative">
                    <img 
                      src={upload.uploaderAvatar || getDefaultAvatar(upload.uploaderId)} 
                      alt={upload.uploaderName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span>{upload.uploaderName}</span>
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
