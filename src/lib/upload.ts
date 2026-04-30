import { supabase } from './supabase';

/**
 * Uploads a blob to Supabase storage with automatic retries and exponential backoff.
 */
export async function uploadWithRetry(
  storagePath: string,
  imageBlob: Blob,
  maxRetries = 3
) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const { data, error } = await supabase.storage
        .from('uploads')
        .upload(storagePath, imageBlob, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: false,
        });

      if (error) {
        // Some Supabase errors might be non-retriable (e.g., bucket not found),
        // but for a "network failure" simulation, we treat them as retriable.
        throw error;
      }
      
      return data;
    } catch (error: any) {
      attempt++;
      
      if (attempt >= maxRetries) {
        console.error(`Upload failed after ${maxRetries} attempts:`, error);
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.warn(`Upload attempt ${attempt} failed. Retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
