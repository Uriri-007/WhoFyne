import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadWithRetry } from './upload';
import { supabase } from './supabase';

// Mock the entire supabase module
vi.mock('./supabase', () => {
  const mockUpload = vi.fn();
  return {
    supabase: {
      storage: {
        from: vi.fn(() => ({
          upload: mockUpload,
        })),
      },
    },
  };
});

describe('uploadWithRetry', () => {
  const storagePath = 'test/path.webp';
  const mockBlob = new Blob(['test'], { type: 'image/webp' });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should successfully upload on the first attempt', async () => {
    const mockUpload = vi.mocked(supabase.storage.from('uploads').upload);
    mockUpload.mockResolvedValue({ data: { path: storagePath }, error: null });

    const result = await uploadWithRetry(storagePath, mockBlob);

    expect(result).toEqual({ path: storagePath });
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('should retry after a network failure and eventually succeed', async () => {
    const mockUpload = vi.mocked(supabase.storage.from('uploads').upload);
    
    // Fail twice with a network-like error, succeed on the third attempt
    mockUpload
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce({ data: { path: storagePath }, error: null });

    const uploadPromise = uploadWithRetry(storagePath, mockBlob, 3);

    // Fast-forward through the first failure delay (1s)
    await vi.advanceTimersByTimeAsync(1000);
    // Fast-forward through the second failure delay (2s)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await uploadPromise;

    expect(result).toEqual({ path: storagePath });
    expect(mockUpload).toHaveBeenCalledTimes(3);
  });

  it('should throw an error after exceeding maximum retries', async () => {
    const mockUpload = vi.mocked(supabase.storage.from('uploads').upload);
    
    // Always fail
    mockUpload.mockRejectedValue(new Error('Persistent Network Failure'));

    const maxRetries = 2;
    const uploadPromise = uploadWithRetry(storagePath, mockBlob, maxRetries);

    // Fast-forward through the retry delay (1s)
    await vi.advanceTimersByTimeAsync(1000);

    await expect(uploadPromise).rejects.toThrow('Persistent Network Failure');
    expect(mockUpload).toHaveBeenCalledTimes(maxRetries);
  });
});
