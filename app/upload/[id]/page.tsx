import { Metadata, ResolvingMetadata } from 'next';
import { supabase } from '@/src/lib/supabase';
import { ArrowLeft, User, Share2, ThumbsUp, ThumbsDown } from 'lucide-react';
import Link from 'next/link';
import { PageTransition } from '@/src/components/Navigation';

interface Props {
  params: Promise<{ id: string }>;
}

async function getUpload(id: string) {
  try {
    const { data, error } = await supabase
      .from('uploads')
      .select('*, uploader:users(username, avatarUrl)')
      .eq('id', id)
      .single();
      
    if (!error && data) {
      return data as any;
    }
  } catch (error) {
    console.error('Error fetching upload:', error);
  }
  return null;
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;
  const upload = await getUpload(id);

  if (!upload) {
    return {
      title: 'Not Found | WhoFyne',
    };
  }

  const appName = "WhoFyne";
  const title = `${upload.title || 'Untitled Capture'} • curator: ${upload.uploader?.username || 'Curator'} | ${appName}`;
  const description = `${upload.title || 'This capture'} was curated by ${upload.uploader?.username || 'a member'}. It has gained ${upload.totalVotes} total votes on ${appName}. Check out the vibrant gallery, cast your vote, and join our creative community!`;

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: 'article',
      url: `/upload/${id}`,
      images: [
        {
          url: upload.imageUrl,
          width: 1200,
          height: 1200,
          alt: upload.title,
        },
      ],
      siteName: appName,
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [upload.imageUrl],
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const upload = await getUpload(id);

  if (!upload) {
    return (
      <PageTransition>
        <div className="max-w-screen-xl mx-auto px-4 py-24 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-3xl flex items-center justify-center mb-6 text-neutral-400 dark:text-neutral-500 transition-colors">
            <User className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50 mb-4 transition-colors">Capture Not Found</h1>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-md mb-8 transition-colors">
            The image you're looking for might have been removed, or the link is incorrect.
          </p>
          <Link 
            href="/" 
            className="px-8 py-3 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-all shadow-lg hover:shadow-indigo-500/20"
          >
            Back to Gallery
          </Link>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 pt-8 pb-32">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Gallery
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Main Content */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-neutral-900 rounded-[40px] overflow-hidden shadow-2xl border border-neutral-100 dark:border-neutral-800 transition-colors">
              <div className="aspect-square sm:aspect-[4/3] lg:aspect-auto overflow-hidden bg-neutral-100 dark:bg-neutral-800 relative min-h-[60vh] flex items-center justify-center transition-colors">
                <img 
                  src={upload.imageUrl || "https://picsum.photos/seed/placeholder/400/500"} 
                  alt={upload.title || "Upload"} 
                  className="w-full h-full object-contain max-h-[80vh]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>

          {/* Details Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-neutral-100 dark:border-neutral-800 shadow-sm transition-colors bg-neutral-100 dark:bg-neutral-800">
                    <img 
                      src={upload.uploader?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${upload.uploaderId}`} 
                      alt={upload.uploader?.username || 'Uploader'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 transition-colors">Curator</p>
                    <p className="font-bold text-neutral-900 dark:text-neutral-50 transition-colors">{upload.uploader?.username || 'Anonymous'}</p>
                  </div>
                </div>
                <div className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-mono text-xs font-bold text-neutral-500 dark:text-neutral-400 transition-colors">
                  {new Date(upload.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight leading-tight transition-colors">
                  {upload.title || 'Untitled Masterpiece'}
                </h1>
                <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed transition-colors">
                  Every capture tells a story of vibrance and community. Cast your vote to influence the leaderboard.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex flex-col items-center transition-colors">
                  <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mb-1 transition-colors">{upload.totalVotes}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 transition-colors">Total Votes</p>
                </div>
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex flex-col items-center transition-colors">
                  <p className="text-3xl font-black text-neutral-900 dark:text-neutral-50 mb-1 transition-colors">{upload.upvotes}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 transition-colors">Upvotes</p>
                </div>
              </div>

              <div className="p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-[40px] border border-indigo-100/50 dark:border-indigo-900/30 flex flex-col items-center gap-6 text-center transition-colors">
                <div className="space-y-2">
                  <p className="font-bold text-indigo-900 dark:text-indigo-200 transition-colors">Want to cast your vote?</p>
                  <p className="text-sm text-indigo-700/80 dark:text-indigo-300/80 transition-colors">Votes are cast directly from our main gallery to ensure fair discovery.</p>
                </div>
                <Link 
                  href="/" 
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Go to Gallery to Vote
                </Link>
                <div className="flex gap-4">
                   <button className="p-3 bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-transparent dark:border-neutral-700 text-neutral-400 dark:text-neutral-600 cursor-not-allowed transition-colors">
                     <ThumbsUp className="w-5 h-5" />
                   </button>
                   <button className="p-3 bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-transparent dark:border-neutral-700 text-neutral-400 dark:text-neutral-600 cursor-not-allowed transition-colors">
                     <ThumbsDown className="w-5 h-5" />
                   </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
