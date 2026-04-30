'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload as UploadIcon, X, Check, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { PageTransition } from '@/src/components/Navigation';

export default function Upload() {
  const { user, profile, isWhitelisted } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [canUpload, setCanUpload] = useState(true);
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function dataUrlToBlob(dataUrl: string) {
    const [metadata, base64] = dataUrl.split(',');
    const mimeMatch = metadata.match(/data:(.*);base64/);
    const mimeType = mimeMatch?.[1] || 'image/webp';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  }

  useEffect(() => {
    async function checkLimit() {
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];
      try {
        const { data, error } = await supabase
          .from('uploads')
          .select('id')
          .eq('uploader_id', user.id)
          .eq('day_key', today)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          setCanUpload(false);
        }
      } catch (error) {
        console.error('Error checking upload limit:', error);
      } finally {
        setCheckingLimit(false);
      }
    }
    checkLimit();
  }, [user]);

  if (!isWhitelisted) {
    return (
      <PageTransition>
        <div className="max-w-xl mx-auto px-4 pt-24 text-center">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-3xl p-8">
            <h2 className="text-2xl font-bold text-amber-800 dark:text-amber-200 mb-2">Access Restricted</h2>
            <p className="text-amber-700 dark:text-amber-300">Only whitelisted creators can upload to WhoFyne. Stay tuned as we expand our curator list!</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (checkingLimit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    );
  }

  if (!canUpload) {
    return (
      <PageTransition>
        <div className="max-w-xl mx-auto px-4 pt-24 text-center">
          <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl p-8">
            <h2 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mb-2">Daily Limit Reached</h2>
            <p className="text-indigo-700 dark:text-indigo-300">In order to keep the gallery curated and vibrant, each uploader is limited to one masterpiece every 24 hours. See you tomorrow!</p>
            <button 
              onClick={() => router.push('/')}
              className="mt-6 px-8 py-3 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
            >
              Back to Gallery
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selected);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user || !profile) return;

    setLoading(true);
    setProgress(10);

    try {
      setProgress(30);
      
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/optimize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Optimization failed');
      }

      const result = await response.json();
      const optimizedBase64 = result.imageUrl;
      
      setProgress(70);

      const today = new Date().toISOString().split('T')[0];
      const storagePath = `${user.id}/${today}-${crypto.randomUUID()}.webp`;
      const imageBlob = dataUrlToBlob(optimizedBase64);

      const { error: storageError } = await supabase.storage
        .from('uploads')
        .upload(storagePath, imageBlob, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: false,
        });

      if (storageError) {
        throw storageError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(storagePath);

      const { error: uploadError } = await supabase.from('uploads').insert({
        uploader_id: user.id,
        image_path: storagePath,
        image_url: publicUrlData.publicUrl,
        title,
        day_key: today,
      });

      if (uploadError) {
        await supabase.storage.from('uploads').remove([storagePath]);
        throw uploadError;
      }

      setProgress(100);
      
      setTimeout(() => router.push('/'), 800);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Unable to upload image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-32">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2 transition-colors">Share Your Vibrance</h1>
          <p className="text-neutral-500 dark:text-neutral-400 transition-colors">Optimized quality, daily curation. One masterpiece at a time.</p>
        </header>

        <form onSubmit={handleUpload} className="space-y-8">
          <div 
            onClick={() => !loading && fileInputRef.current?.click()}
            className={`relative aspect-[4/3] rounded-[40px] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden ${
              preview ? 'border-neutral-200 dark:border-neutral-700' : 'border-neutral-300 dark:border-neutral-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
            }`}
          >
            {preview ? (
              <>
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                  className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 text-neutral-400 dark:text-neutral-500 transition-colors">
                <div className="p-6 bg-neutral-100 dark:bg-neutral-800 rounded-3xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all">
                  <UploadIcon className="w-10 h-10" />
                </div>
                <p className="font-medium text-neutral-500 dark:text-neutral-400">Drop your capture here or <span className="text-indigo-600 dark:text-indigo-400">browse</span></p>
                <p className="text-xs">PNG, JPG up to 10MB</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*"
            />
          </div>

          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-2">Display Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-6 py-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 focus:border-indigo-600 dark:focus:border-indigo-500 transition-all outline-none dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                placeholder="Golden Hour in the City"
                required
              />
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl p-6 flex gap-4 items-start transition-colors border border-transparent dark:border-neutral-800">
              <Sparkles className="w-6 h-6 text-amber-500 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 transition-colors">Optimizer Active</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed transition-colors">We automatically balance resolution and file size to ensure your image is crystal clear for everyone while preserving database performance.</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className={`w-full py-5 rounded-3xl font-bold transition-all shadow-xl flex items-center justify-center gap-3 ${
                loading || !file 
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processing {progress}%
                </>
              ) : (
                <>
                  <Check className="w-6 h-6" />
                  Publish To Gallery
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </PageTransition>
  );
}
