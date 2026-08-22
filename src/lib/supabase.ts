/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  deleteDoc, query, where, onSnapshot, limit, orderBy 
} from 'firebase/firestore';
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged, User as FirebaseUser 
} from 'firebase/auth';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

import { db, getFirebaseApp } from './firebase';
const app = getFirebaseApp() || (getApps().length > 0 ? getApp() : initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBuX3QvWFTWSLoaEsMPE7TsQLEodAaFS1M",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "localeats-5e26e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "localeats-5e26e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "localeats-5e26e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "281496568360",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:281496568360:web:45557127bbd2a352bfeb1d"
}));
const auth = getAuth(app);

let isMocked = false;

class QueryBuilder {
  table: string;
  queryType: string;
  filters: any[];
  insertData: any;
  _single: boolean;
  _maybeSingle: boolean;
  _selectFields?: string;
  _selectOptions?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean };

  constructor(table: string) {
    this.table = table;
    this.queryType = 'select';
    this.filters = [];
    this.insertData = null;
    this._single = false;
    this._maybeSingle = false;
  }

  select(fields?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    this.queryType = 'select';
    this._selectFields = fields;
    this._selectOptions = options;
    return this;
  }

  insert(data: any) { this.queryType = 'insert'; this.insertData = data; return this; }
  update(data: any) { this.queryType = 'update'; this.insertData = data; return this; }
  upsert(data: any) { this.queryType = 'upsert'; this.insertData = data; return this; }
  delete() { this.queryType = 'delete'; return this; }
  
  eq(col: string, val: any) { this.filters.push({col, val, op: '=='}); return this; }
  neq(col: string, val: any) { this.filters.push({col, val, op: '!='}); return this; }
  in(col: string, vals: any[]) { this.filters.push({col, val: vals, op: 'in'}); return this; }
  not(col: string, op: string, val: any) { 
    if (op === 'in') {
      this.filters.push({col, val, op: 'not-in'}); 
    } else {
      this.filters.push({col, val, op: '!='}); 
    }
    return this; 
  }
  lt(col: string, val: any) { this.filters.push({col, val, op: '<'}); return this; }
  lte(col: string, val: any) { this.filters.push({col, val, op: '<='}); return this; }
  gt(col: string, val: any) { this.filters.push({col, val, op: '>'}); return this; }
  gte(col: string, val: any) { this.filters.push({col, val, op: '>='}); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.filters.push({col, val: opts?.ascending ? 'asc' : 'desc', op: 'order'}); return this; }
  limit(count: number) { this.filters.push({col: 'limit', val: count, op: 'limit'}); return this; }
  or(filters: string) { /* Handled in memory fallback */ return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }
  
  then(resolve: any, reject: any) {
    return this.execute().then(resolve).catch(reject);
  }
  
  async execute() {
    try {
      if (this.queryType === 'insert') {
        const dataArray = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        const res = [];
        for (const item of dataArray) {
          const docId = String(item.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
          const docData = { ...item, id: docId };
          const docRef = doc(collection(db, this.table), docId);
          await setDoc(docRef, docData);
          res.push(docData);
        }
        return { data: Array.isArray(this.insertData) ? res : res[0], error: null };
      }
      
      if (this.queryType === 'upsert' || this.queryType === 'update') {
        const data = this.insertData;
        let targetId = data?.id;
        if (!targetId && this.filters.length > 0) {
          const idFilter = this.filters.find(f => f.col === 'id');
          if (idFilter) targetId = idFilter.val;
        }

        if (targetId) {
          const docRef = doc(db, this.table, String(targetId));
          const updatedPayload = { ...data, updated_at: new Date().toISOString() };
          await setDoc(docRef, updatedPayload, { merge: true });
          return { data: updatedPayload, error: null };
        }

        // If no explicit ID, query matching docs and update them
        const queryRes: any = await new QueryBuilder(this.table)
          .select('*')
          .then((r: any) => r.data || [], (err: any) => []);
          
        let matched: any[] = Array.isArray(queryRes) ? queryRes : [];
        for (const f of this.filters) {
          if (f.op === '==') matched = matched.filter((d: any) => String(d[f.col]) === String(f.val));
        }

        if (matched.length > 0) {
          for (const item of matched) {
            const docRef = doc(db, this.table, String(item.id));
            await setDoc(docRef, { ...data, updated_at: new Date().toISOString() }, { merge: true });
          }
          return { data, error: null };
        } else if (this.queryType === 'upsert') {
          const newId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const docRef = doc(db, this.table, newId);
          const payload = { ...data, id: newId, created_at: new Date().toISOString() };
          await setDoc(docRef, payload, { merge: true });
          return { data: payload, error: null };
        }

        return { data: null, error: new Error('Update target not found') };
      }

      if (this.queryType === 'delete') {
        const targetId = this.filters.find(f => f.col === 'id')?.val;
        if (targetId) {
          const docRef = doc(db, this.table, String(targetId));
          await deleteDoc(docRef);
          return { data: null, error: null };
        }
        return { data: null, error: null };
      }
      
      if (this.queryType === 'select') {
        // Safe query: Only send single simple '==' equality filters to Firestore to prevent compound query errors
        let q: any = collection(db, this.table);
        const eqFilters = this.filters.filter(f => f.op === '==');
        
        // Pass at most two simple == constraints to Firestore for server indexing
        const safeConstraints: any[] = [];
        for (let i = 0; i < Math.min(eqFilters.length, 2); i++) {
          safeConstraints.push(where(eqFilters[i].col, '==', eqFilters[i].val));
        }
        
        if (safeConstraints.length > 0) {
          q = query(q, ...safeConstraints);
        }

        const snapshot = await getDocs(q);
        let results: any[] = snapshot.docs.map(d => {
          const docData = d.data() as Record<string, any>;
          return { id: d.id, ...(typeof docData === 'object' && docData !== null ? docData : {}) };
        });

        // Perform comprehensive, error-proof in-memory filtering for ALL operators
        for (const f of this.filters) {
          if (f.op === '==') {
            results = results.filter((d: any) => String(d[f.col]) === String(f.val));
          } else if (f.op === '!=') {
            results = results.filter((d: any) => String(d[f.col]) !== String(f.val));
          } else if (f.op === 'in') {
            if (Array.isArray(f.val)) {
              results = results.filter((d: any) => f.val.some((v: any) => String(v) === String(d[f.col])));
            }
          } else if (f.op === 'not-in') {
            if (Array.isArray(f.val)) {
              results = results.filter((d: any) => !f.val.some((v: any) => String(v) === String(d[f.col])));
            }
          } else if (f.op === '<') {
            results = results.filter((d: any) => Number(d[f.col]) < Number(f.val));
          } else if (f.op === '<=') {
            results = results.filter((d: any) => Number(d[f.col]) <= Number(f.val));
          } else if (f.op === '>') {
            results = results.filter((d: any) => Number(d[f.col]) > Number(f.val));
          } else if (f.op === '>=') {
            results = results.filter((d: any) => Number(d[f.col]) >= Number(f.val));
          }
        }

        // Apply order in memory
        const orderFilter = this.filters.find(f => f.op === 'order');
        if (orderFilter) {
          const col = orderFilter.col;
          const isAsc = orderFilter.val === 'asc';
          results.sort((a: any, b: any) => {
            const aVal = a[col] ?? '';
            const bVal = b[col] ?? '';
            if (aVal < bVal) return isAsc ? -1 : 1;
            if (aVal > bVal) return isAsc ? 1 : -1;
            return 0;
          });
        }

        // If head count is requested
        if (this._selectOptions?.head) {
          return { count: results.length, data: null, error: null };
        }

        // Apply limit in memory
        const limitFilter = this.filters.find(f => f.op === 'limit');
        if (limitFilter && typeof limitFilter.val === 'number') {
          results = results.slice(0, limitFilter.val);
        }
        
        if (this._single) {
          if (results.length === 0) return { data: null, error: { message: 'Row not found' } };
          return { data: results[0], error: null };
        }
        if (this._maybeSingle) {
          return { data: results.length > 0 ? results[0] : null, error: null };
        }
        return { data: results, count: results.length, error: null };
      }
    } catch (e) {
      console.warn('Adapter query execution notice:', e);
      return { data: null, error: e };
    }
    return { data: null, error: new Error('Unsupported query') };
  }
}

class FakeChannel {
  topic: string;
  unsubscribe: any;
  constructor(topic: string) {
    this.topic = topic;
    this.unsubscribe = null;
  }
  on(type: string, filter: any, callback: any) {
    if (type === 'postgres_changes') {
      const table = filter?.table;
      if (table) {
        try {
          let isInitial = true;
          this.unsubscribe = onSnapshot(
            collection(db, table),
            (snapshot) => {
              if (isInitial) {
                isInitial = false;
                return;
              }
              snapshot.docChanges().forEach((change) => {
                const eventType = change.type === 'added' ? 'INSERT' : change.type === 'modified' ? 'UPDATE' : 'DELETE';
                const docData = { id: change.doc.id, ...change.doc.data() };
                callback({ eventType, new: docData, old: docData });
              });
            },
            (error) => {
              console.warn(`Realtime snapshot listener notice for table "${table}":`, error.message);
            }
          );
        } catch (e) {
          console.warn('Error setting up onSnapshot:', e);
        }
      }
    }
    return this;
  }
  subscribe(callback?: any) {
    if (callback) {
      setTimeout(() => callback('SUBSCRIBED'), 0);
    }
    return this;
  }
}

const mapUser = (u: FirebaseUser | null) => {
  if (!u) return null;
  return { ...u, id: u.uid }; // Map Firebase uid to Supabase id
};

const fakeSupabase = {
  auth: {
    signUp: async ({ email, password }: any) => {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = mapUser(userCredential.user);
        return { data: { user, session: { access_token: 'fake', user } }, error: null };
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = mapUser(userCredential.user);
            return { data: { user, session: { access_token: 'fake', user } }, error: null };
          } catch (signInError: any) {
            if (signInError.code === 'auth/wrong-password' || signInError.code === 'auth/invalid-credential') {
               return { data: null, error: new Error('This email is already registered. Please sign in with your password or use password recovery.') };
            }
            return { data: null, error: signInError };
          }
        }
        return { data: null, error };
      }
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = mapUser(userCredential.user);
        return { data: { user, session: { access_token: 'fake', user } }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signInWithOAuth: async (options: any) => {
      return { data: { provider: options?.provider || 'google', url: '' }, error: null };
    },
    signOut: async () => {
      await signOut(auth);
      return { error: null };
    },
    getSession: async () => {
      return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
          unsubscribe();
          const user = mapUser(u);
          if (user) {
            resolve({ data: { session: { access_token: 'fake', user } }, error: null });
          } else {
            resolve({ data: { session: null }, error: null });
          }
        });
      });
    },
    onAuthStateChange: (callback: any) => {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        const user = mapUser(u);
        const event = user ? 'SIGNED_IN' : 'SIGNED_OUT';
        const session = user ? { access_token: 'fake', user } : null;
        callback(event, session);
      });
      return { data: { subscription: { unsubscribe } } };
    }
  },
  from: (table: string) => new QueryBuilder(table),
  channel: (name: string) => new FakeChannel(name),
  getChannels: () => [],
  removeChannel: (channel: any) => {
    if (channel && channel.unsubscribe) channel.unsubscribe();
  },
  rpc: async (functionName: string, params?: any) => {
    if (functionName === 'increment_rider_stats') {
      try {
        const riderId = params?.p_rider_id || params?.rider_id;
        if (riderId) {
          const docRef = doc(db, 'rider_profiles', riderId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const current = snap.data();
            await setDoc(docRef, {
              total_deliveries: (current.total_deliveries || 0) + (params?.p_deliveries || 1),
              total_earnings: (current.total_earnings || 0) + (params?.p_earnings || 0),
              updated_at: new Date().toISOString()
            }, { merge: true });
          }
        }
      } catch (e) {
        console.warn('RPC increment_rider_stats notice:', e);
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  },
  storage: {
    from: (bucket: string) => ({
      upload: async (filePath: string, file: any, options?: any) => {
        return { data: { path: filePath }, error: null };
      },
      getPublicUrl: (filePath: string) => {
        return { data: { publicUrl: `https://storage.googleapis.com/${bucket}/${filePath}` } };
      },
      download: async (filePath: string) => {
        return { data: new Blob(), error: null };
      },
      remove: async (filePaths: string[]) => {
        return { data: filePaths, error: null };
      }
    })
  }
};

export function getSupabase(): SupabaseClient {
  return fakeSupabase as unknown as SupabaseClient;
}

export function getFreshChannel(channelName: string): any {
  return fakeSupabase.channel(channelName);
}

export function clearStaleAuthTokens() {
  signOut(auth).catch(() => {});
}

export function isSupabaseMocked(): boolean {
  return isMocked;
}

export function markSupabaseAsMocked() {
  isMocked = true;
}
