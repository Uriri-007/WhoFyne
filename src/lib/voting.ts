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

  // 4. Update uploader's total count and handle rank change notifications
  const { data: uploaderDoc } = await supabase
    .from('users')
    .select('id, username, totalVotesReceived')
    .eq('id', uploaderId)
    .single();
    
  if (uploaderDoc) {
    const oldScore = uploaderDoc.totalVotesReceived || 0;
    const newScore = oldScore + (type === 'up' ? 1 : -1);

    // Calculate old rank
    const { count: higherBefore } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('isUploader', true)
      .gt('totalVotesReceived', oldScore);
    const oldRank = (higherBefore || 0) + 1;

    // Perform the score update
    await supabase
      .from('users')
      .update({ totalVotesReceived: newScore })
      .eq('id', uploaderId);

    // Calculate new rank
    const { count: higherAfter } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('isUploader', true)
      .gt('totalVotesReceived', newScore);
    const newRank = (higherAfter || 0) + 1;

    // Helper for notifications
    const notifyUser = async (targetUserId: string, notifType: string, message: string) => {
      await supabase.from('notifications').insert([{
        userId: targetUserId,
        type: notifType,
        message,
        createdAt: new Date().toISOString()
      }]);
    };

    if (newRank < oldRank) {
       // Uploader climbed! Find those with the exact oldScore we just passed
       const { data: displacedUsers } = await supabase
         .from('users')
         .select('id, username')
         .eq('isUploader', true)
         .eq('totalVotesReceived', oldScore)
         .neq('id', uploaderId);
       
       if (displacedUsers && displacedUsers.length > 0) {
          const displacedNames = displacedUsers.map(u => u.username).join(', ');
          await notifyUser(uploaderId, 'rank_up', `You climbed up in rank! You displaced ${displacedNames} and are now at position #${newRank}.`);
          
          for (const du of displacedUsers) {
             const duRank = newRank + 1; // Since uploader passed them
             await notifyUser(du.id, 'rank_down', `You've been displaced by ${uploaderDoc.username} and you're now at position #${duRank}.`);
          }
       } else {
          await notifyUser(uploaderId, 'rank_up', `You climbed up in rank! You are now at position #${newRank}.`);
       }
    } else if (newRank > oldRank) {
       // Uploader fell! Find those who passed them (who have exactly the newScore)
       const { data: overtakingUsers } = await supabase
         .from('users')
         .select('id, username')
         .eq('isUploader', true)
         .eq('totalVotesReceived', newScore)
         .neq('id', uploaderId);

       if (overtakingUsers && overtakingUsers.length > 0) {
          const overTakers = overtakingUsers.map(u => u.username).join(', ');
          await notifyUser(uploaderId, 'rank_down', `You've been displaced by ${overTakers} and you're now at position #${newRank}.`);
          
          for (const ou of overtakingUsers) {
             const ouRank = newRank - 1; // Since uploader fell below them
             await notifyUser(ou.id, 'rank_up', `You climbed up in rank! You displaced ${uploaderDoc.username} and are now at position #${ouRank}.`);
          }
       } else {
          await notifyUser(uploaderId, 'rank_down', `Your rank dropped. You're now at position #${newRank}.`);
       }
    }

    // Add a standard notification for the vote if it was an upvote
    if (type === 'up') {
      const { data: voterData } = await supabase.from('users').select('username').eq('id', userId).single();
      const voterName = voterData?.username || 'Someone';
      await notifyUser(uploaderId, 'vote', `${voterName} voted on your image.`);
    }
  }

  return { success: true, newTotal };
}
