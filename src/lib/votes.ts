import { supabase } from './supabase';

export async function castVote(userId: string, uploadId: string, type: 'up' | 'down') {
  // We check if the user is voting for their own upload
  // Note: The database also has a trigger 'before_vote_insert' to validate this
  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .select('uploader_id')
    .eq('id', uploadId)
    .single();

  if (uploadError) throw new Error('Upload not found');
  if (upload.uploader_id === userId) {
    throw new Error('You cannot vote for your own upload.');
  }

  // Insert the vote. The unique constraint 'votes_one_per_user_per_upload' 
  // on (user_id, upload_id) will prevent duplicates at the DB level.
  const { error } = await supabase
    .from('votes')
    .insert({
      user_id: userId,
      upload_id: uploadId,
      type,
    });

  if (error) {
    if (error.code === '23505') { // Postgres unique_violation
      throw new Error('You have already voted for this upload.');
    }
    throw error;
  }

  return { success: true };
}
