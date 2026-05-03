import { supabase } from './supabase';

/**
 * Casts a vote for an upload.
 * 
 * @param userId - The ID of the user casting the vote
 * @param uploadId - The ID of the upload being voted on
 * @param type - The type of vote ('up' or 'down')
 * @param uploaderId - The ID of the user who uploaded the image
 */
export async function castVote(userId: string, uploadId: string, type: 'up' | 'down', uploaderId: string) {
  if (uploaderId === userId) {
    throw new Error('You cannot vote for your own upload.');
  }

  // Composite key to prevent duplicates at the DB level as well
  const voteId = `${userId}_${uploadId}`;

  // 1. Check if already voted
  const { data: existingVote, error: checkError } = await supabase
    .from('votes')
    .select('id')
    .eq('id', voteId)
    .single();

  if (existingVote) {
    throw new Error('You have already voted on this image.');
  }

  // 2. Insert vote
  const { error: insertError } = await supabase
    .from('votes')
    .insert([{
      id: voteId,
      userId,
      uploadId,
      type,
      createdAt: new Date().toISOString()
    }]);

  if (insertError) {
    // Handling duplicate key error if check failed or race condition occurred
    if (insertError.code === '23505') {
       throw new Error('You have already voted on this image.');
    }
    throw new Error(insertError.message || 'Failed to record vote');
  }

  // 3. Update upload counts
  // We fetch first to ensure we have the latest baseline, though not perfectly atomic
  const { data: uploadData, error: fetchError } = await supabase
    .from('uploads')
    .select('upvotes, downvotes, totalVotes')
    .eq('id', uploadId)
    .single();

  if (fetchError) throw new Error('Failed to update upload counts');

  const newUpvotes = type === 'up' ? (uploadData.upvotes || 0) + 1 : (uploadData.upvotes || 0);
  const newDownvotes = type === 'down' ? (uploadData.downvotes || 0) + 1 : (uploadData.downvotes || 0);
  const newTotal = newUpvotes - newDownvotes;

  const { error: updateError } = await supabase
    .from('uploads')
    .update({
      upvotes: newUpvotes,
      downvotes: newDownvotes,
      totalVotes: newTotal
    })
    .eq('id', uploadId);

  if (updateError) throw new Error('Failed to finalize vote counts');

  // 4. Update uploader's total count
  const { data: uploaderDoc } = await supabase
    .from('users')
    .select('totalVotesReceived')
    .eq('id', uploaderId)
    .single();
    
  if (uploaderDoc) {
    const currentTotal = uploaderDoc.totalVotesReceived || 0;
    await supabase
      .from('users')
      .update({
        totalVotesReceived: currentTotal + (type === 'up' ? 1 : -1)
      })
      .eq('id', uploaderId);
  }

  return { success: true, newTotal };
}
