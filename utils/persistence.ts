
const DB_NAME = 'LuxuryChristmasTreeDB';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

interface SavedPhoto {
  id: string;
  url: string; // Base64 Data URL
  aspectRatio: number;
  timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const savePhotoToDB = async (id: string, url: string, aspectRatio: number) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const photo: SavedPhoto = { id, url, aspectRatio, timestamp: Date.now() };
    
    const request = store.put(photo);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deletePhotoFromDB = async (id: string) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllPhotosFromDB = async (): Promise<{ id: string, url: string, aspectRatio: number }[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results: SavedPhoto[] = request.result;
      // Sort by timestamp to maintain order
      results.sort((a, b) => a.timestamp - b.timestamp);
      resolve(results.map(r => ({ id: r.id, url: r.url, aspectRatio: r.aspectRatio })));
    };
    request.onerror = () => reject(request.error);
  });
};
