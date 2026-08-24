import { initializeApp as initAdminApp, getApps as getAdminApps, getApp as getAdminApp, App as AdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { initializeApp as initClientApp, getApps as getClientApps, getApp as getClientApp } from 'firebase/app';
import { initializeFirestore as initClientFirestore, getFirestore as getClientFirestore, doc, collection, getDoc, setDoc, updateDoc, runTransaction as clientRunTransaction, Firestore as ClientFirestore } from 'firebase/firestore';

const PROJECT_ID = 'localeats-5e26e';
const FIRESTORE_DATABASE_ID = 'ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe';

const firebaseClientConfig = {
  apiKey: "AIzaSyBuX3QvWFTWSLoaEsMPE7TsQLEodAaFS1M",
  authDomain: "localeats-5e26e.firebaseapp.com",
  projectId: PROJECT_ID,
  storageBucket: "localeats-5e26e.firebasestorage.app",
  messagingSenderId: "281496568360",
  appId: "1:281496568360:web:45557127bbd2a352bfeb1d"
};

// Admin SDK App
let adminAppInstance: AdminApp | null = null;
let adminDbInstance: AdminFirestore | null = null;

try {
  if (!getAdminApps().length) {
    adminAppInstance = initAdminApp({ projectId: PROJECT_ID });
  } else {
    adminAppInstance = getAdminApp();
  }
  adminDbInstance = getAdminFirestore(adminAppInstance, FIRESTORE_DATABASE_ID);
} catch (e) {
  // Ignored in client/test environment
}

// Web Client SDK App (Fallback for tests without GCP ADC)
let clientAppInstance: any = null;
let clientDbInstance: ClientFirestore | null = null;

function getClientDb(): ClientFirestore {
  if (!clientDbInstance) {
    if (getClientApps().length > 0) {
      clientAppInstance = getClientApp();
    } else {
      clientAppInstance = initClientApp(firebaseClientConfig);
    }
    try {
      clientDbInstance = initClientFirestore(clientAppInstance, { experimentalAutoDetectLongPolling: true }, FIRESTORE_DATABASE_ID);
    } catch {
      clientDbInstance = getClientFirestore(clientAppInstance, FIRESTORE_DATABASE_ID);
    }
  }
  return clientDbInstance;
}

export interface GenericDocSnapshot {
  exists: boolean;
  id: string;
  data(): Record<string, any> | undefined;
}

export interface GenericTransaction {
  get(docRef: any): Promise<GenericDocSnapshot>;
  update(docRef: any, data: Record<string, any>): void;
  set(docRef: any, data: Record<string, any>): void;
}

export interface GenericDocRef {
  id: string;
  path: string;
  get(): Promise<GenericDocSnapshot>;
  set(data: Record<string, any>): Promise<void>;
  update(data: Record<string, any>): Promise<void>;
}

export interface GenericCollectionRef {
  doc(id: string): GenericDocRef;
}

export interface IBackendDb {
  collection(name: string): GenericCollectionRef;
  doc(path: string): GenericDocRef;
  runTransaction<T>(updateFunction: (transaction: GenericTransaction) => Promise<T>): Promise<T>;
}

class UniversalDbAdapter implements IBackendDb {
  private useClientFallback = false;

  collection(name: string): GenericCollectionRef {
    return {
      doc: (id: string) => this.doc(`${name}/${id}`)
    };
  }

  doc(path: string): GenericDocRef {
    const segments = path.split('/').filter(Boolean);
    const colName = segments[0];
    const docId = segments[1];

    return {
      id: docId,
      path,
      get: async () => {
        if (!this.useClientFallback && adminDbInstance) {
          try {
            const snap = await adminDbInstance.collection(colName).doc(docId).get();
            return {
              exists: snap.exists,
              id: snap.id,
              data: () => snap.data()
            };
          } catch (e: any) {
            if (e.code === 7 || e.message?.includes('PERMISSION_DENIED')) {
              this.useClientFallback = true;
            } else {
              throw e;
            }
          }
        }

        const clientDb = getClientDb();
        const clientRef = doc(clientDb, colName, docId);
        const snap = await getDoc(clientRef);
        return {
          exists: snap.exists(),
          id: snap.id,
          data: () => snap.data() as Record<string, any>
        };
      },
      set: async (data: Record<string, any>) => {
        if (!this.useClientFallback && adminDbInstance) {
          try {
            await adminDbInstance.collection(colName).doc(docId).set(data);
            return;
          } catch (e: any) {
            if (e.code === 7 || e.message?.includes('PERMISSION_DENIED')) {
              this.useClientFallback = true;
            } else {
              throw e;
            }
          }
        }

        const clientDb = getClientDb();
        const clientRef = doc(clientDb, colName, docId);
        await setDoc(clientRef, data);
      },
      update: async (data: Record<string, any>) => {
        if (!this.useClientFallback && adminDbInstance) {
          try {
            await adminDbInstance.collection(colName).doc(docId).update(data);
            return;
          } catch (e: any) {
            if (e.code === 7 || e.message?.includes('PERMISSION_DENIED')) {
              this.useClientFallback = true;
            } else {
              throw e;
            }
          }
        }

        const clientDb = getClientDb();
        const clientRef = doc(clientDb, colName, docId);
        await updateDoc(clientRef, data);
      }
    };
  }

  async runTransaction<T>(updateFunction: (transaction: GenericTransaction) => Promise<T>): Promise<T> {
    if (!this.useClientFallback && adminDbInstance) {
      try {
        return await adminDbInstance.runTransaction(async (adminTx) => {
          const adaptedTx: GenericTransaction = {
            get: async (docRef: GenericDocRef) => {
              const [col, id] = docRef.path.split('/');
              const snap = await adminTx.get(adminDbInstance!.collection(col).doc(id));
              return {
                exists: snap.exists,
                id: snap.id,
                data: () => snap.data()
              };
            },
            update: (docRef: GenericDocRef, data: Record<string, any>) => {
              const [col, id] = docRef.path.split('/');
              adminTx.update(adminDbInstance!.collection(col).doc(id), data);
            },
            set: (docRef: GenericDocRef, data: Record<string, any>) => {
              const [col, id] = docRef.path.split('/');
              adminTx.set(adminDbInstance!.collection(col).doc(id), data);
            }
          };
          return await updateFunction(adaptedTx);
        });
      } catch (e: any) {
        if (e.code === 7 || e.message?.includes('PERMISSION_DENIED')) {
          this.useClientFallback = true;
        } else {
          throw e;
        }
      }
    }

    const clientDb = getClientDb();
    return await clientRunTransaction(clientDb, async (clientTx) => {
      const adaptedTx: GenericTransaction = {
        get: async (docRef: GenericDocRef) => {
          const [col, id] = docRef.path.split('/');
          const snap = await clientTx.get(doc(clientDb, col, id));
          return {
            exists: snap.exists(),
            id: snap.id,
            data: () => snap.data() as Record<string, any>
          };
        },
        update: (docRef: GenericDocRef, data: Record<string, any>) => {
          const [col, id] = docRef.path.split('/');
          clientTx.update(doc(clientDb, col, id), data);
        },
        set: (docRef: GenericDocRef, data: Record<string, any>) => {
          const [col, id] = docRef.path.split('/');
          clientTx.set(doc(clientDb, col, id), data);
        }
      };
      return await updateFunction(adaptedTx);
    });
  }
}

export const backendDb: IBackendDb = new UniversalDbAdapter();
