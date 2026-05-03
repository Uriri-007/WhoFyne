import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock sharp
vi.mock('sharp', () => {
  return {
    default: vi.fn(() => ({
      resize: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('optimized')),
    })),
  };
});

describe('POST /api/optimize API Route', () => {
  it('should return 400 if no file is provided in the request', async () => {
    const req = {
      formData: vi.fn().mockResolvedValue({
        get: (key: string) => null
      }),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('No file uploaded');
  });

  it('should optimize a valid image and return a webp buffer', async () => {
    const mockFile = {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    
    const req = {
      formData: vi.fn().mockResolvedValue({
        get: (key: string) => mockFile
      }),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    
    // Check if the body contains the "optimized" buffer we mocked
    const body = await res.arrayBuffer();
    expect(Buffer.from(body).toString()).toBe('optimized');
  });

  it('should return 500 if an optimization error occurs', async () => {
    // Re-mock sharp to throw for this test
    const sharp = await import('sharp');
    (sharp.default as any).mockImplementationOnce(() => ({
      resize: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockRejectedValue(new Error('Sharp error')),
    }));

    const mockFile = {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    
    const req = {
      formData: vi.fn().mockResolvedValue({
        get: (key: string) => mockFile
      }),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to optimize image');
  });
});
