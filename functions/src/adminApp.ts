import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'localeats-5e26e';
const FIRESTORE_DATABASE_ID = 'ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe';

let app: App;
if (!getApps().length) {
  app = initializeApp({
    projectId: PROJECT_ID,
  });
} else {
  app = getApp();
}

export const adminApp = app;
export const adminDb: Firestore = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
