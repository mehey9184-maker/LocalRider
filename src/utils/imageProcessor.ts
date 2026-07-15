/**
 * LocalEatsSA High-Compression Proof-of-Delivery Image Processor
 * Compressed client-side downscale pipeline + IndexedDB Offline Persistence Queue.
 */

const DB_NAME = 'localeats_sa_rider_pwa_db';
const STORE_NAME = 'offline_pod_queue';

export interface QueuedProofOfDelivery {
  id: string; // Primary Key (orderId)
  orderId: string;
  blob: Blob;
  capturedAt: string;
}

/**
 * Compresses any File or Blob containing an image to WebP format.
 * Automatically scales down the image to fit a max boundary of 800x800px.
 * Converts to WebP format at 60% quality to optimize for South African low-data cellular.
 */
export const compressProofImage = (
  fileOrBlob: Blob | File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.6
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(fileOrBlob);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain original aspect ratio while respecting maximum boundaries
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas rendering context not available.'));
          return;
        }

        // Apply clean downscale interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP with low footprint target
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate image Blob from compressed canvas.'));
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (err) => reject(new Error(`Failed to load source image: ${err}`));
    };
    reader.onerror = (err) => reject(new Error(`Failed to read file buffer: ${err}`));
  });
};

/**
 * Initializes the IndexedDB offline database store.
 */
export const initPodIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (e: Event) => {
      resolve((e.target as IDBOpenDBRequest).result);
    };

    request.onerror = (e: Event) => {
      reject((e.target as IDBOpenDBRequest).error);
    };
  });
};

/**
 * Adds a compressed WebP photo to the IndexedDB local sync queue.
 */
export const queueProofOfDelivery = async (
  orderId: string,
  compressedBlob: Blob
): Promise<void> => {
  const db = await initPodIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const data: QueuedProofOfDelivery = {
      id: orderId,
      orderId,
      blob: compressedBlob,
      capturedAt: new Date().toISOString(),
    };

    const request = store.put(data);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Retrieves all queued offline Proof-of-Delivery items from IndexedDB.
 */
export const getQueuedProofDeliveries = async (): Promise<QueuedProofOfDelivery[]> => {
  const db = await initPodIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Removes an successfully uploaded Proof-of-Delivery item from IndexedDB.
 */
export const deleteQueuedProofDelivery = async (orderId: string): Promise<void> => {
  const db = await initPodIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(orderId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};
