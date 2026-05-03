import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { castVote } from './voting';
import { supabase } from './supabase';

vi.mock('./supabase', () => {
  const mockTable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };

  return {
    supabase: {
      from: vi.fn(() => mockTable),
    },
    isSupabaseConfigured: true,
  };
});

describe('Voting Logic Unit Tests', () => {
  const mockFrom = supabase.from as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent a user from voting for their own upload', async () => {
    await expect(castVote('user123', 'upload456', 'up', 'user123'))
      .rejects.toThrow('You cannot vote for your own upload.');
  });

  it('should prevent duplicate votes by checking existing records', async () => {
    // Mock the check for existing vote to return a record
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'user1_upload1' }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    });

    await expect(castVote('user1', 'upload1', 'up', 'uploaderA'))
      .rejects.toThrow('You have already voted on this image.');
    
    expect(mockSingle).toHaveBeenCalled();
  });

  it('should prevent duplicate votes on 23505 insertion error (race condition safety)', async () => {
    // 1. Check passes (no vote found)
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    // 2. Insert fails with duplicate key
    const mockInsert = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });

    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
      insert: mockInsert,
    }));

    await expect(castVote('user1', 'upload1', 'up', 'uploaderA'))
      .rejects.toThrow('You have already voted on this image.');
  });

  it('should correctly update votes counts in the database', async () => {
    // Mock flow:
    // 1. No existing vote
    // 2. Insert vote success
    // 3. Get current upload votes (up: 10, down: 2)
    // 4. Update upload votes success
    // 5. Get uploader profile success (totalReceived: 50)
    // 6. Update uploader profile success

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      // Return different things based on the call sequence or table
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) return { data: null, error: { code: 'PGRST116' } }; // Check vote
          if (callCount === 2) return { data: { upvotes: 10, downvotes: 2, totalVotes: 8 }, error: null }; // Get upload
          if (callCount === 3) return { data: { totalVotesReceived: 50 }, error: null }; // Get uploader
          return { data: null, error: null };
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
        }),
      };
    });

    const result = await castVote('user_voter', 'upload_target', 'up', 'uploader_target');

    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(9); // 11 - 2
    
    // Check if correct data was used in updates
    // The second from('uploads') call should update with new values
    expect(mockFrom).toHaveBeenCalledWith('uploads');
    expect(mockFrom).toHaveBeenCalledWith('users');
  });

  it('should correctly handle downvotes', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) return { data: null, error: { code: 'PGRST116' } };
          if (callCount === 2) return { data: { upvotes: 10, downvotes: 2, totalVotes: 8 }, error: null };
          if (callCount === 3) return { data: { totalVotesReceived: 50 }, error: null };
          return { data: null, error: null };
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
        }),
      };
    });

    const result = await castVote('user_voter', 'upload_target', 'down', 'uploader_target');

    expect(result.success).toBe(true);
    expect(result.newTotal).toBe(7); // 10 - 3
  });
});
