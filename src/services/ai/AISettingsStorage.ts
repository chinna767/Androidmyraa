import { apiUrl } from '../../config/backendConfig';
import { AISettings, AIProviderType } from '../../types';

const STORAGE_KEY = 'myraa_secure_ai_settings_v1';
const GEMINI_BACKUP_KEY = 'myraa_gemini_api_key_v1';
const GROK_BACKUP_KEY = 'myraa_grok_api_key_v1';
const PREFERRED_PROVIDER_KEY = 'myraa_preferred_provider_v1';
const AUTO_FALLBACK_KEY = 'myraa_auto_fallback_v1';
const OBFUSCATION_SALT = 0x5a;

const DEFAULT_SETTINGS: AISettings = {
  geminiApiKey: '',
  grokApiKey: '',
  preferredProvider: 'gemini',
  automaticFallback: true,
};

type SettingsListener = (settings: AISettings) => void;

class AISettingsStorage {
  private inMemoryCache: AISettings | null = null;
  private listeners: Set<SettingsListener> = new Set();
  private hasSyncedWithServer = false;

  constructor() {
    // Automatically trigger initial server sync on load in browser
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.syncWithServer().catch((e) => {
          console.warn('[AISettingsStorage] Initial server sync deferred:', e.message);
        });
      }, 50);
    }
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(settings: AISettings) {
    for (const listener of this.listeners) {
      try {
        listener({ ...settings });
      } catch (err) {
        console.warn('[AISettingsStorage] Listener error:', err);
      }
    }
  }

  /**
   * Obfuscates text safely to prevent plain-text storage in inspect tools
   */
  private obfuscate(text: string): string {
    if (!text || typeof text !== 'string') return '';
    const trimmed = text.trim();
    if (!trimmed) return '';
    try {
      const utf8 = encodeURIComponent(trimmed);
      const charCodes = Array.from(utf8).map((c) => c.charCodeAt(0) ^ OBFUSCATION_SALT);
      return btoa(String.fromCharCode(...charCodes));
    } catch {
      return trimmed;
    }
  }

  /**
   * De-obfuscates text safely, falling back to raw text if needed
   */
  private deobfuscate(encoded: string): string {
    if (!encoded || typeof encoded !== 'string') return '';
    const trimmed = encoded.trim();
    if (!trimmed) return '';

    try {
      const raw = atob(trimmed);
      const decodedChars = Array.from(raw).map((c) =>
        String.fromCharCode(c.charCodeAt(0) ^ OBFUSCATION_SALT)
      );
      const decoded = decodeURIComponent(decodedChars.join(''));
      if (decoded) return decoded;
    } catch {
      // Fallback: If it was stored in plain text or atob fails, return raw
    }

    return trimmed;
  }

  /**
   * Read from local browser storage layers
   */
  private readFromLocal(): AISettings {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      let geminiKey = '';
      let grokKey = '';
      let preferredProvider: AIProviderType = 'gemini';
      let automaticFallback = true;

      // 1. Try primary JSON block
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          geminiKey = this.deobfuscate(parsed.geminiApiKeyEncrypted || parsed.geminiApiKey || '');
          grokKey = this.deobfuscate(parsed.grokApiKeyEncrypted || parsed.grokApiKey || '');
          preferredProvider = parsed.preferredProvider === 'grok' ? 'grok' : 'gemini';
          automaticFallback = parsed.automaticFallback !== false;
        } catch {
          // JSON parse failed, fallback to backup keys
        }
      }

      // 2. Try redundant individual backup keys if primary was empty
      if (!geminiKey) {
        const backupGemini = localStorage.getItem(GEMINI_BACKUP_KEY) || sessionStorage.getItem(GEMINI_BACKUP_KEY);
        if (backupGemini) {
          geminiKey = this.deobfuscate(backupGemini);
        }
      }

      if (!grokKey) {
        const backupGrok = localStorage.getItem(GROK_BACKUP_KEY) || sessionStorage.getItem(GROK_BACKUP_KEY);
        if (backupGrok) {
          grokKey = this.deobfuscate(backupGrok);
        }
      }

      const backupProvider = localStorage.getItem(PREFERRED_PROVIDER_KEY);
      if (backupProvider === 'grok' || backupProvider === 'gemini') {
        preferredProvider = backupProvider;
      }

      return {
        geminiApiKey: geminiKey,
        grokApiKey: grokKey,
        preferredProvider,
        automaticFallback,
      };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Get current AI Settings synchronously
   */
  public getSettings(): AISettings {
    if (this.inMemoryCache) {
      return { ...this.inMemoryCache };
    }

    const loaded = this.readFromLocal();
    this.inMemoryCache = loaded;
    return { ...loaded };
  }

  /**
   * Synchronize with the persistent server backend
   */
  public async syncWithServer(): Promise<AISettings> {
    try {
      const res = await fetch(apiUrl('/api/ai/settings'));
      if (res.ok) {
        const serverData = await res.json();
        const current = this.getSettings();

        // Merge: If server has saved keys, adopt them.
        // If client has local keys that server doesn't have yet, push local to server.
        let changed = false;
        const merged: AISettings = { ...current };

        if (serverData.geminiApiKey && serverData.geminiApiKey !== current.geminiApiKey) {
          merged.geminiApiKey = serverData.geminiApiKey;
          changed = true;
        } else if (current.geminiApiKey && !serverData.geminiApiKey) {
          // Push client's key to server
          this.pushToServer(current);
        }

        if (serverData.grokApiKey && serverData.grokApiKey !== current.grokApiKey) {
          merged.grokApiKey = serverData.grokApiKey;
          changed = true;
        } else if (current.grokApiKey && !serverData.grokApiKey) {
          this.pushToServer(current);
        }

        if (serverData.preferredProvider && serverData.preferredProvider !== current.preferredProvider) {
          merged.preferredProvider = serverData.preferredProvider;
          changed = true;
        }

        if (changed) {
          this.writeToLocal(merged);
          this.inMemoryCache = merged;
          this.notifyListeners(merged);
        }
        this.hasSyncedWithServer = true;
        return merged;
      }
    } catch (err) {
      // Server sync deferred
    }
    return this.getSettings();
  }

  /**
   * Write to local browser storage layers
   */
  private writeToLocal(settings: AISettings) {
    if (typeof window === 'undefined') return;

    try {
      const payloadToStore = {
        geminiApiKeyEncrypted: this.obfuscate(settings.geminiApiKey || ''),
        grokApiKeyEncrypted: this.obfuscate(settings.grokApiKey || ''),
        preferredProvider: settings.preferredProvider,
        automaticFallback: settings.automaticFallback,
        updatedAt: new Date().toISOString(),
      };

      // 1. Primary localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadToStore));

      // 2. Redundant individual backup keys in localStorage & sessionStorage
      if (settings.geminiApiKey) {
        const encGemini = this.obfuscate(settings.geminiApiKey);
        localStorage.setItem(GEMINI_BACKUP_KEY, encGemini);
        sessionStorage.setItem(GEMINI_BACKUP_KEY, encGemini);
      } else {
        localStorage.removeItem(GEMINI_BACKUP_KEY);
        sessionStorage.removeItem(GEMINI_BACKUP_KEY);
      }

      if (settings.grokApiKey) {
        const encGrok = this.obfuscate(settings.grokApiKey);
        localStorage.setItem(GROK_BACKUP_KEY, encGrok);
        sessionStorage.setItem(GROK_BACKUP_KEY, encGrok);
      } else {
        localStorage.removeItem(GROK_BACKUP_KEY);
        sessionStorage.removeItem(GROK_BACKUP_KEY);
      }

      localStorage.setItem(PREFERRED_PROVIDER_KEY, settings.preferredProvider);
      localStorage.setItem(AUTO_FALLBACK_KEY, settings.automaticFallback ? 'true' : 'false');
    } catch (err) {
      console.warn('[AISettingsStorage] Local storage write notice:', err);
    }
  }

  /**
   * Asynchronously push settings to server persistent disk
   */
  private async pushToServer(settings: AISettings) {
    try {
      await fetch(apiUrl('/api/ai/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: settings.geminiApiKey,
          grokApiKey: settings.grokApiKey,
          preferredProvider: settings.preferredProvider,
          automaticFallback: settings.automaticFallback,
        }),
      });
    } catch (e) {
      console.warn('[AISettingsStorage] Server push notice:', e);
    }
  }

  /**
   * Save AI Settings immediately and persistently
   */
  public saveSettings(updated: Partial<AISettings>): AISettings {
    const current = this.getSettings();
    const newSettings: AISettings = {
      ...current,
      ...updated,
    };

    this.inMemoryCache = { ...newSettings };
    this.writeToLocal(newSettings);
    this.pushToServer(newSettings);
    this.notifyListeners(newSettings);

    return { ...newSettings };
  }

  /**
   * Delete or clear a specific provider key permanently
   */
  public clearKey(provider: AIProviderType): AISettings {
    if (provider === 'gemini') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(GEMINI_BACKUP_KEY);
        sessionStorage.removeItem(GEMINI_BACKUP_KEY);
      }
      fetch(apiUrl('/api/ai/settings/key/gemini'), { method: 'DELETE' }).catch(() => {});
      return this.saveSettings({ geminiApiKey: '' });
    } else {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(GROK_BACKUP_KEY);
        sessionStorage.removeItem(GROK_BACKUP_KEY);
      }
      fetch(apiUrl('/api/ai/settings/key/grok'), { method: 'DELETE' }).catch(() => {});
      return this.saveSettings({ grokApiKey: '' });
    }
  }

  /**
   * Get safe masked representation for UI display (e.g. "••••••••1234")
   */
  public getMaskedKey(key: string): string {
    if (!key || key.trim().length === 0) return '';
    const trimmed = key.trim();
    if (trimmed.length <= 6) {
      return '••••••••';
    }
    const end = trimmed.slice(-4);
    return `••••••••••••${end}`;
  }
}

export const aiSettingsStorage = new AISettingsStorage();
