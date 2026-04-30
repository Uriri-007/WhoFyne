import { describe, it, expect, vi, beforeEach } from 'vitest';
import { castVote } from './votes';
import { supabase } from './supabase';

// Mock the entire supabase module
vi.mock('./supabase', () => {
  const mockSingle = vi.fn();
  const mockInsert = vi.fn();
  const mockEq = vi.fn(() => ({
    single: mockSingle,
  }));
  const mockSelect = vi.fn(() => ({
    eq: mockEq,
  }));
  const mockFrom = vi.fn((table) => {
    if (table === 'uploads') {
      return { select: mockSelect };
    }
    if (table === 'votes') {
      return { insert: mockInsert };
    }
    return {};
  });

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

describe('castVote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent voting for your own upload', async () => {
    const userId = 'user-1';
    const uploadId = 'upload-1';
    
    // Setup the specific mock response for this test
    const mockFrom = vi.mocked(supabase.from);
    const mockUploads = mockFrom('uploads') as any;
    mockUploads.select().eq().single.mockResolvedValue({
      data: { uploader_id: userId },
      error: null,
    });

    await expect(castVote(userId, uploadId, 'up')).rejects.toThrow('You cannot vote for your own upload.');
  });

  it('should prevent duplicate votes using Postgres error code', async () => {
    const userId = 'user-1';
    const uploadId = 'upload-1';

    const mockFrom = vi.mocked(supabase.from);
    const mockUploads = mockFrom('uploads') as any;
    mockUploads.select().eq().single.mockResolvedValue({
      data: { uploader_id: 'user-2' },
      error: null,
    });

    const mockVotes = mockFrom('votes') as any;
    mockVotes.insert.mockResolvedValue({
      error: { code: '23505' },
    });

    await expect(castVote(userId, uploadId, 'up')).rejects.toThrow('You have already voted for this upload.');
  });

  it('should successfully cast a vote', async () => {
    const userId = 'user-1';
    const uploadId = 'upload-1';

    const mockFrom = vi.mocked(supabase.from);
    const mockUploads = mockFrom('uploads') as any;
    mockUploads.select().eq().single.mockResolvedValue({
      data: { uploader_id: 'user-2' },
      error: null,
    });

    const mockVotes = mockFrom('votes') as any;
    mockVotes.insert.mockResolvedValue({
      error: null,
    });

    const result = await castVote(userId, uploadId, 'up');
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('votes');
  });
});
