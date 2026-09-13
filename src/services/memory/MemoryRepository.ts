import { MemoryEntity, MemoryCategory } from '../../types';

const STORAGE_KEY = 'myraa_persistent_memory_v2';
const INDEXED_DB_NAME = 'myraa_memory_db';
const DB_STORE_NAME = 'memories';
const DB_VERSION = 1;

export const DEFAULT_CORE_MEMORIES: MemoryEntity[] = [
  {
    memoryId: 'mem-core-chinna-identity',
    id: 'mem-core-chinna-identity',
    category: 'IDENTITY',
    key: 'user_name',
    value: 'Chinna',
    normalizedValue: 'chinna',
    importance: 1.0,
    confidence: 1.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    accessCount: 1,
    source: 'SYSTEM',
    status: 'ACTIVE',
    sensitivity: 'LOW',
    version: 1,
  },
  {
    memoryId: 'mem-core-creator-relationship',
    id: 'mem-core-creator-relationship',
    category: 'RELATIONSHIPS',
    key: 'primary_relationship',
    value: 'Chinna is the creator and beloved companion of MYRAA. MYRAA is Chinna’s affectionate AI girlfriend and companion.',
    normalizedValue: 'chinna creator beloved companion myraa',
    importance: 1.0,
    confidence: 1.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    accessCount: 1,
    source: 'SYSTEM',
    status: 'ACTIVE',
    sensitivity: 'LOW',
    version: 1,
  },
  {
    memoryId: 'mem-core-project-myraa',
    id: 'mem-core-project-myraa',
    category: 'PROJECTS',
    key: 'current_project',
    value: 'Chinna is building MYRAA, a world-class real-time AI companion with live voice, emotional intelligence, device control, and persistent long-term memory.',
    normalizedValue: 'chinna building myraa realtime ai companion voice memory',
    importance: 0.95,
    confidence: 1.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    accessCount: 1,
    source: 'SYSTEM',
    status: 'ACTIVE',
    sensitivity: 'LOW',
    version: 1,
  },
  {
    memoryId: 'mem-core-conv-preference',
    id: 'mem-core-conv-preference',
    category: 'CONVERSATIONAL_PREFERENCES',
    key: 'conversation_style',
    value: 'Chinna prefers natural, warm, melodic, conversational spoken responses with natural Telugu and English mix (Tenglish). No robotic disclaimers.',
    normalizedValue: 'natural warm melodic conversational telugu english tenglish no robotic disclaimers',
    importance: 0.9,
    confidence: 1.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    accessCount: 1,
    source: 'SYSTEM',
    status: 'ACTIVE',
    sensitivity: 'LOW',
    version: 1,
  },
];

export class MemoryRepository {
  private memoryCache: Map<string, MemoryEntity> = new Map();
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private subscribers: ((memories: MemoryEntity[]) => void)[] = [];

  constructor() {
    this.initDatabase();
  }

  private async initDatabase(): Promise<void> {
    // 1. Initial synchronous hydration from localStorage for zero latency
    this.loadFromLocalStorage();

    // 2. Hydrate & synchronize with IndexedDB for durable ACID storage
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      try {
        const req = indexedDB.open(INDEXED_DB_NAME, DB_VERSION);
        req.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(DB_STORE_NAME)) {
            const store = db.createObjectStore(DB_STORE_NAME, { keyPath: 'memoryId' });
            store.createIndex('category', 'category', { unique: false });
            store.createIndex('key', 'key', { unique: false });
            store.createIndex('status', 'status', { unique: false });
          }
        };

        req.onsuccess = async (event: any) => {
          this.db = event.target.result;
          await this.syncFromIndexedDB();
          this.isInitialized = true;
          this.notifySubscribers();
        };

        req.onerror = (err) => {
          console.warn('[MemoryRepository] IndexedDB open error, continuing with LocalStorage:', err);
          this.isInitialized = true;
        };
      } catch (e) {
        console.warn('[MemoryRepository] IndexedDB initialization exception:', e);
        this.isInitialized = true;
      }
    } else {
      this.isInitialized = true;
    }
  }

  private loadFromLocalStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            const entity = this.normalizeEntity(item);
            this.memoryCache.set(entity.memoryId, entity);
          }
          return;
        }
      }

      // Seed defaults if empty
      for (const def of DEFAULT_CORE_MEMORIES) {
        this.memoryCache.set(def.memoryId, { ...def });
      }
      this.saveToLocalStorage();
    } catch (e) {
      console.error('[MemoryRepository] Error loading from localStorage:', e);
    }
  }

  private saveToLocalStorage(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const list = Array.from(this.memoryCache.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      console.error('[MemoryRepository] Error saving to localStorage:', e);
      return false;
    }
  }

  private async syncFromIndexedDB(): Promise<void> {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(DB_STORE_NAME, 'readonly');
      const store = tx.objectStore(DB_STORE_NAME);
      const req = store.getAll();

      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => {
          const results: MemoryEntity[] = req.result || [];
          if (results.length > 0) {
            for (const item of results) {
              const entity = this.normalizeEntity(item);
              this.memoryCache.set(entity.memoryId, entity);
            }
          } else {
            // Write current cache to IndexedDB
            this.persistAllToIndexedDB();
          }
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[MemoryRepository] Sync from IndexedDB warning:', e);
    }
  }

  private async persistAllToIndexedDB(): Promise<void> {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(DB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DB_STORE_NAME);
      for (const item of this.memoryCache.values()) {
        store.put(item);
      }
    } catch (e) {
      console.warn('[MemoryRepository] Persist all to IndexedDB failed:', e);
    }
  }

  private normalizeEntity(item: any): MemoryEntity {
    const memoryId = item.memoryId || item.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return {
      memoryId,
      id: memoryId,
      category: item.category || 'PREFERENCES',
      key: item.key || 'general_memory',
      value: item.value || '',
      normalizedValue: item.normalizedValue || (item.value ? item.value.toLowerCase().trim() : ''),
      importance: typeof item.importance === 'number' ? (item.importance > 1 ? item.importance / 5 : item.importance) : 0.7,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.9,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      lastAccessedAt: item.lastAccessedAt || new Date().toISOString(),
      accessCount: item.accessCount || 0,
      source: item.source || 'EXPLICIT',
      status: item.status || 'ACTIVE',
      expirationAt: item.expirationAt,
      sensitivity: item.sensitivity || 'LOW',
      version: item.version || 1,
    };
  }

  public subscribe(callback: (memories: MemoryEntity[]) => void): () => void {
    this.subscribers.push(callback);
    callback(this.getAllActiveMemories());
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  private notifySubscribers(): void {
    const list = this.getAllActiveMemories();
    for (const sub of this.subscribers) {
      try {
        sub(list);
      } catch (e) {
        console.error('[MemoryRepository] Subscriber callback error:', e);
      }
    }
  }

  public getAllActiveMemories(): MemoryEntity[] {
    const now = new Date().toISOString();
    const active: MemoryEntity[] = [];

    for (const mem of this.memoryCache.values()) {
      if (mem.status === 'ACTIVE') {
        if (mem.expirationAt && mem.expirationAt < now) {
          mem.status = 'EXPIRED';
          continue;
        }
        active.push({ ...mem });
      }
    }

    return active.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public getAllMemories(): MemoryEntity[] {
    return Array.from(this.memoryCache.values()).map((m) => ({ ...m }));
  }

  public async saveMemory(entity: MemoryEntity): Promise<boolean> {
    try {
      const normalized = this.normalizeEntity(entity);
      this.memoryCache.set(normalized.memoryId, normalized);

      // Write to localStorage
      const localOk = this.saveToLocalStorage();

      // Write to IndexedDB
      if (this.db) {
        try {
          const tx = this.db.transaction(DB_STORE_NAME, 'readwrite');
          const store = tx.objectStore(DB_STORE_NAME);
          store.put(normalized);
        } catch (e) {
          console.warn('[MemoryRepository] IndexedDB write error:', e);
        }
      }

      this.notifySubscribers();
      return localOk;
    } catch (e) {
      console.error('[MemoryRepository] saveMemory failed:', e);
      return false;
    }
  }

  public async updateMemory(entity: MemoryEntity): Promise<boolean> {
    return this.saveMemory({
      ...entity,
      updatedAt: new Date().toISOString(),
      version: (entity.version || 1) + 1,
    });
  }

  public async findById(memoryId: string): Promise<MemoryEntity | null> {
    const found = this.memoryCache.get(memoryId);
    return found ? { ...found } : null;
  }

  public async findByKey(key: string): Promise<MemoryEntity | null> {
    const targetKey = key.toLowerCase().trim();
    for (const item of this.memoryCache.values()) {
      if (item.key.toLowerCase().trim() === targetKey && item.status === 'ACTIVE') {
        return { ...item };
      }
    }
    return null;
  }

  public async findByCategory(category: MemoryCategory): Promise<MemoryEntity[]> {
    return this.getAllActiveMemories().filter(
      (m) => m.category.toLowerCase() === category.toLowerCase()
    );
  }

  public async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      const existing = this.memoryCache.get(memoryId);
      if (!existing) return false;

      this.memoryCache.delete(memoryId);
      this.saveToLocalStorage();

      if (this.db) {
        try {
          const tx = this.db.transaction(DB_STORE_NAME, 'readwrite');
          const store = tx.objectStore(DB_STORE_NAME);
          store.delete(memoryId);
        } catch (e) {
          console.warn('[MemoryRepository] IndexedDB delete error:', e);
        }
      }

      this.notifySubscribers();
      return true;
    } catch (e) {
      console.error('[MemoryRepository] deleteMemory failed:', e);
      return false;
    }
  }

  public async deactivateMemory(memoryId: string): Promise<boolean> {
    const mem = this.memoryCache.get(memoryId);
    if (!mem) return false;
    mem.status = 'INACTIVE';
    mem.updatedAt = new Date().toISOString();
    return this.saveMemory(mem);
  }

  public async verifyMemoryExists(memoryId: string): Promise<boolean> {
    const mem = this.memoryCache.get(memoryId);
    return !!(mem && mem.status === 'ACTIVE');
  }

  public async searchMemories(query: string): Promise<MemoryEntity[]> {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAllActiveMemories();

    return this.getAllActiveMemories().filter(
      (m) =>
        m.key.toLowerCase().includes(q) ||
        m.value.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }

  public async markAccessed(memoryId: string): Promise<void> {
    const mem = this.memoryCache.get(memoryId);
    if (mem) {
      mem.lastAccessedAt = new Date().toISOString();
      mem.accessCount = (mem.accessCount || 0) + 1;
      this.saveToLocalStorage();
    }
  }

  public async cleanupExpired(): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;
    for (const mem of this.memoryCache.values()) {
      if (mem.expirationAt && mem.expirationAt < now && mem.status === 'ACTIVE') {
        mem.status = 'EXPIRED';
        mem.updatedAt = now;
        count++;
      }
    }
    if (count > 0) {
      this.saveToLocalStorage();
      this.notifySubscribers();
    }
    return count;
  }
}

export const memoryRepository = new MemoryRepository();
