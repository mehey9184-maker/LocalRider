import imageCompression from 'browser-image-compression';
import { getSupabase, isSupabaseMocked } from './supabase';

/**
 * File to Base64/DataURL helper for local/offline fallback rendering
 */
function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Canvas compression fallback in case browser-image-compression fails in strict iframe context
 */
async function compressWithCanvas(file: File, maxWidthOrHeight: number, quality = 0.8): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
          height = Math.round((height * maxWidthOrHeight) / width);
          width = maxWidthOrHeight;
        } else {
          width = Math.round((width * maxWidthOrHeight) / height);
          height = maxWidthOrHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob || file),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/**
 * Uploads and compresses rider profile picture.
 * Bucket: 'avatars'
 * Path: `rider-avatars/${riderId}.jpg`
 * Rules: maxSizeMB: 0.2 (200 KB max), maxWidthOrHeight: 800px
 */
export async function uploadRiderProfilePic(riderId: string, cameraFile: File): Promise<string> {
  let compressed: Blob;
  
  try {
    const options = { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: true };
    compressed = await imageCompression(cameraFile, options);
  } catch (err) {
    console.warn('browser-image-compression failed, using canvas fallback:', err);
    compressed = await compressWithCanvas(cameraFile, 800, 0.8);
  }

  const filePath = `rider-avatars/${riderId}.jpg`;
  let publicUrl = '';

  if (!isSupabaseMocked()) {
    try {
      const { error } = await getSupabase().storage
        .from('avatars')
        .upload(filePath, compressed, { 
          upsert: true,
          contentType: 'image/jpeg' 
        });

      if (error) {
        console.warn('Supabase avatars storage upload warning:', error.message);
      } else {
        const { data } = getSupabase().storage.from('avatars').getPublicUrl(filePath);
        if (data?.publicUrl) {
          publicUrl = data.publicUrl;
        }
      }
    } catch (e) {
      console.warn('Supabase storage upload exception:', e);
    }
  }

  // Fallback to Data URL for instant rendering if storage upload fails or is mocked
  if (!publicUrl) {
    publicUrl = await fileToDataUrl(compressed);
  }

  // Cache locally
  localStorage.setItem(`localeats_avatar_${riderId}`, publicUrl);

  // Sync with rider_profiles table in Supabase
  if (!isSupabaseMocked()) {
    try {
      await getSupabase()
        .from('rider_profiles')
        .update({ photo_url: publicUrl })
        .eq('id', riderId);
    } catch (syncErr) {
      console.warn('Could not sync photo_url to rider_profiles:', syncErr);
    }
    
    try {
      await getSupabase()
        .from('riders')
        .update({ avatar_url: publicUrl, photo_url: publicUrl })
        .eq('id', riderId);
    } catch {
      // Ignore if riders table is not present
    }
  }

  return publicUrl;
}

/**
 * Uploads and compresses optional Cash-on-Arrival or dropoff delivery proof photo.
 * Bucket: 'delivery-proofs'
 * Path: `orders/${orderId}_proof.jpg`
 * Rules: maxSizeMB: 0.25 (250 KB max), maxWidthOrHeight: 1280px
 */
export async function uploadDeliveryProofPhoto(orderId: string, cameraFile: File): Promise<string> {
  let compressed: Blob;

  try {
    const options = { maxSizeMB: 0.25, maxWidthOrHeight: 1280, useWebWorker: true };
    compressed = await imageCompression(cameraFile, options);
  } catch (err) {
    console.warn('browser-image-compression failed for proof photo, using canvas fallback:', err);
    compressed = await compressWithCanvas(cameraFile, 1280, 0.8);
  }

  const filePath = `orders/${orderId}_proof.jpg`;
  let publicUrl = '';

  if (!isSupabaseMocked()) {
    try {
      const { error } = await getSupabase().storage
        .from('delivery-proofs')
        .upload(filePath, compressed, { 
          upsert: true,
          contentType: 'image/jpeg' 
        });

      if (error) {
        console.warn('Supabase delivery-proofs storage upload warning:', error.message);
      } else {
        const { data } = getSupabase().storage.from('delivery-proofs').getPublicUrl(filePath);
        if (data?.publicUrl) {
          publicUrl = data.publicUrl;
        }
      }
    } catch (e) {
      console.warn('Supabase delivery proof upload exception:', e);
    }
  }

  // Fallback to Data URL if offline or mocked
  if (!publicUrl) {
    publicUrl = await fileToDataUrl(compressed);
  }

  // Cache locally
  localStorage.setItem(`localeats_proof_${orderId}`, publicUrl);

  // Sync with orders table
  if (!isSupabaseMocked()) {
    try {
      await getSupabase()
        .from('orders')
        .update({ dropoff_photo_ref: publicUrl })
        .eq('id', orderId);
    } catch (syncErr) {
      console.warn('Could not sync dropoff_photo_ref to orders table:', syncErr);
    }
  }

  return publicUrl;
}
