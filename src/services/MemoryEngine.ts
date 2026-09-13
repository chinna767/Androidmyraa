import {
  MemoryEntity,
  MemoryCategory,
  MemorySource,
  MemoryEvent,
  MemoryEventType,
  MemoryDiagnostics,
} from '../types';
import { memoryRepository, MemoryRepository } from './memory/MemoryRepository';
import { MemoryValidator } from './memory/MemoryValidator';
import { MemoryScorer } from './memory/MemoryScorer';
import { MemoryPrivacyManager } from './memory/MemoryPrivacyManager';
import { MemoryConflictResolver } from './memory/MemoryConflictResolver';
import { MemoryExtractor, ExtractorResult } from './memory/MemoryExtractor';
import { MemoryForgetter } from './memory/MemoryForgetter';
import { MemoryRetriever } from './memory/MemoryRetriever';
import { MemoryContextBuilder } from './memory/MemoryContextBuilder';

export class MemoryEngine {
  private repository: MemoryRepository;
  private eventListeners: ((event: MemoryEvent) => void)[] = [];
  private lastRetrievedCount = 0;
  private lastSavedMemoryTitle = '';
  private lastLatencyMs = 0;

  constructor(repo: MemoryRepository = memoryRepository) {
    this.repository = repo;
    // Periodic cleanup of expired memories
    setInterval(() => {
      this.repository.cleanupExpired().catch(() => {});
    }, 60000);
  }

  public subscribe(callback: (memories: MemoryEntity[]) => void): () => void {
    return this.repository.subscribe(callback);
  }

  public onEvent(callback: (event: MemoryEvent) => void): () => void {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter((cb) => cb !== callback);
    };
  }

  private emitEvent(type: MemoryEventType, details: string, data?: any, memoryId?: string, key?: string) {
    const event: MemoryEvent = {
      id: `mem-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      timestamp: new Date().toISOString(),
      memoryId,
      key,
      details,
      data,
    };
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[MemoryEngine] Event listener error:', e);
      }
    }
  }

  public getAllMemories(): MemoryEntity[] {
    return this.repository.getAllMemories();
  }

  public getActiveMemories(): MemoryEntity[] {
    return this.repository.getAllActiveMemories();
  }

  /**
   * Saves or updates a memory with validation, scoring, conflict resolution, and persistence verification.
   */
  public async saveMemory(
    key: string,
    value: string,
    category: MemoryCategory = 'PREFERENCES',
    source: MemorySource = 'EXPLICIT',
    importance: number = 0.85
  ): Promise<{ success: boolean; record: MemoryEntity | null; error?: string }> {
    const startTime = performance.now();
    try {
      // 1. Privacy evaluation
      const privacy = MemoryPrivacyManager.evaluateSensitivity(`${key} ${value}`);
      if (privacy.isBlocked) {
        this.emitEvent('MemoryPrivacyBlocked', `Memory candidate blocked by privacy: ${privacy.reason}`);
        return { success: false, record: null, error: privacy.reason };
      }

      // 2. Candidate validation
      const validation = MemoryValidator.validateCandidate({
        key,
        value,
        category,
        importance,
        source,
        sensitivity: privacy.sensitivity,
        isExplicit: source === 'EXPLICIT' || source === 'explicit' || source === 'manual',
      });

      if (!validation.isValid || !validation.sanitizedCandidate) {
        this.emitEvent('MemorySaveFailed', `Validation failed: ${validation.reason}`);
        return { success: false, record: null, error: validation.reason };
      }

      const candidate = validation.sanitizedCandidate;

      // 3. Conflict resolution
      const resolution = await MemoryConflictResolver.resolve(candidate, this.repository);

      let savedRecord: MemoryEntity;

      if (resolution.action === 'REJECT_CONFLICT') {
        return { success: true, record: resolution.targetEntity || null };
      } else if (resolution.action === 'UPDATE_EXISTING' && resolution.updatedEntity) {
        savedRecord = resolution.updatedEntity;
        const updateOk = await this.repository.updateMemory(savedRecord);
        if (!updateOk) {
          throw new Error('Database write verification failed during update');
        }
        this.emitEvent('MemoryUpdated', resolution.reason, savedRecord, savedRecord.memoryId, savedRecord.key);
      } else {
        const memoryId = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        savedRecord = {
          memoryId,
          id: memoryId,
          category: candidate.category,
          key: candidate.key,
          value: candidate.value,
          normalizedValue: candidate.normalizedValue,
          importance: candidate.importance,
          confidence: candidate.confidence,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          accessCount: 1,
          source: candidate.source,
          status: 'ACTIVE',
          expirationAt: candidate.expirationAt,
          sensitivity: candidate.sensitivity,
          version: 1,
        };

        const saveOk = await this.repository.saveMemory(savedRecord);
        if (!saveOk) {
          throw new Error('Database write verification failed');
        }
        this.emitEvent('MemorySaved', `Saved new memory: ${savedRecord.key}`, savedRecord, savedRecord.memoryId, savedRecord.key);
      }

      // 4. Double-check verification from persistent storage
      const exists = await this.repository.verifyMemoryExists(savedRecord.memoryId);
      if (!exists) {
        throw new Error('Storage verification check failed');
      }

      this.lastSavedMemoryTitle = `${savedRecord.key}: ${savedRecord.value}`;
      this.lastLatencyMs = Math.round(performance.now() - startTime);

      return { success: true, record: savedRecord };
    } catch (err: any) {
      this.emitEvent('MemorySaveFailed', `Save memory error: ${err.message}`);
      return { success: false, record: null, error: err.message };
    }
  }

  /**
   * Deletes a memory by ID.
   */
  public async deleteMemory(id: string): Promise<boolean> {
    const ok = await this.repository.deleteMemory(id);
    if (ok) {
      this.emitEvent('MemoryForgotten', `Deleted memory ${id}`, null, id);
    }
    return ok;
  }

  /**
   * Forgets a memory by keyword using MemoryForgetter.
   */
  public async forgetByKeyword(keyword: string): Promise<{ success: boolean; count: number; message: string }> {
    const result = await MemoryForgetter.forget(keyword, this.repository);
    if (result.success && result.forgottenCount > 0) {
      this.emitEvent('MemoryForgotten', `Forgotten ${result.forgottenCount} memories matching "${keyword}"`);
    }
    return {
      success: result.success,
      count: result.forgottenCount,
      message: result.message,
    };
  }

  /**
   * Synchronous / immediate detection of explicit memory and forget voice commands.
   * e.g. "Remember that my favorite game is Minecraft", "Forget that my favorite game is Minecraft"
   */
  public async detectAndProcessMemoryCommandAsync(userText: string): Promise<{
    isMemoryCommand: boolean;
    isForgetCommand: boolean;
    actionMessage?: string;
    savedRecord?: MemoryEntity | null;
  }> {
    const extraction: ExtractorResult = MemoryExtractor.extract(userText);

    if (extraction.isExplicitForget && extraction.forgetKeyword) {
      const forgetRes = await this.forgetByKeyword(extraction.forgetKeyword);
      return {
        isMemoryCommand: false,
        isForgetCommand: true,
        actionMessage: forgetRes.message,
      };
    }

    if (extraction.isExplicitRemember && extraction.candidate) {
      const c = extraction.candidate;
      const saveRes = await this.saveMemory(c.key, c.value, c.category, 'EXPLICIT', c.importance);

      if (saveRes.success && saveRes.record) {
        return {
          isMemoryCommand: true,
          isForgetCommand: false,
          savedRecord: saveRes.record,
          actionMessage: `Got it, Chinna. I'll remember that ${c.value}.`,
        };
      } else {
        return {
          isMemoryCommand: true,
          isForgetCommand: false,
          actionMessage: "I couldn't save that to my memory just now, Chinna.",
        };
      }
    }

    return { isMemoryCommand: false, isForgetCommand: false };
  }

  /**
   * Backward-compatible synchronous wrapper for quick checks.
   */
  public detectAndProcessMemoryCommand(userText: string): {
    isMemoryCommand: boolean;
    isForgetCommand: boolean;
    actionMessage?: string;
    savedRecord?: MemoryEntity | null;
  } {
    const extraction = MemoryExtractor.extract(userText);
    if (extraction.isExplicitForget || extraction.isExplicitRemember) {
      // Trigger async processing immediately
      this.detectAndProcessMemoryCommandAsync(userText);
      if (extraction.isExplicitForget) {
        return {
          isMemoryCommand: false,
          isForgetCommand: true,
          actionMessage: `I've removed that from my memory, Chinna.`,
        };
      }
      if (extraction.isExplicitRemember && extraction.candidate) {
        return {
          isMemoryCommand: true,
          isForgetCommand: false,
          actionMessage: `Got it, Chinna. I'll remember that ${extraction.candidate.value}.`,
        };
      }
    }
    return { isMemoryCommand: false, isForgetCommand: false };
  }

  /**
   * Background / asynchronous processing of natural conversation turns.
   */
  public async processUtteranceForAutomaticMemory(userText: string): Promise<void> {
    try {
      const extraction = MemoryExtractor.extract(userText);
      if (extraction.candidate && !extraction.candidate.isExplicit) {
        const c = extraction.candidate;
        this.emitEvent('MemoryCandidateDetected', `Auto-detected candidate: ${c.key} = ${c.value}`);
        await this.saveMemory(c.key, c.value, c.category, 'AUTOMATIC', c.importance);
      }
    } catch (e) {
      console.warn('[MemoryEngine] Automatic extraction warning:', e);
    }
  }

  /**
   * Retrieves relevant memories for a prompt using semantic scoring.
   */
  public async retrieveRelevantMemories(prompt: string, limit: number = 6): Promise<MemoryEntity[]> {
    const list = await MemoryRetriever.retrieveRelevantMemories(prompt, this.repository, limit);
    this.lastRetrievedCount = list.length;
    this.emitEvent('MemoryRetrieved', `Retrieved ${list.length} memories for prompt`);
    return list;
  }

  /**
   * Formats relevant memories synchronously into concise, natural context for Gemini.
   */
  public getMemoriesPromptContextSync(prompt?: string): string {
    const active = this.getActiveMemories();
    if (!prompt || !prompt.trim()) {
      return MemoryContextBuilder.buildPromptContext(active.slice(0, 8));
    }

    const lowerPrompt = prompt.toLowerCase();
    const relevant = active.filter((m) => {
      if (m.category === 'IDENTITY' || m.importance >= 0.95) return true;
      if (lowerPrompt.includes(m.key.toLowerCase())) return true;
      if (lowerPrompt.includes(m.normalizedValue)) return true;
      if (
        (lowerPrompt.includes('game') || lowerPrompt.includes('play')) &&
        (m.key.includes('game') || m.category === 'PREFERENCES' || m.category === 'Preference')
      ) return true;
      if (
        (lowerPrompt.includes('song') || lowerPrompt.includes('music')) &&
        (m.key.includes('music') || m.key.includes('song'))
      ) return true;
      if (
        (lowerPrompt.includes('project') || lowerPrompt.includes('myraa') || lowerPrompt.includes('building')) &&
        (m.category === 'PROJECTS' || m.category === 'Project')
      ) return true;
      return false;
    });

    const chosen = relevant.length > 0 ? relevant.slice(0, 7) : active.slice(0, 6);
    this.lastRetrievedCount = chosen.length;
    return MemoryContextBuilder.buildPromptContext(chosen);
  }

  /**
   * Formats relevant memories into concise, natural context for Gemini.
   */
  public getMemoriesPromptContext(prompt?: string): string {
    return this.getMemoriesPromptContextSync(prompt);
  }

  /**
   * Diagnostics for Telemetry Panel.
   */
  public getDiagnostics(): MemoryDiagnostics {
    const all = this.repository.getAllMemories();
    const active = all.filter((m) => m.status === 'ACTIVE');
    const expired = all.filter((m) => m.status === 'EXPIRED');

    return {
      totalMemories: all.length,
      activeMemories: active.length,
      expiredMemories: expired.length,
      lastRetrievedCount: this.lastRetrievedCount,
      lastSavedMemory: this.lastSavedMemoryTitle,
      databaseStatus: 'SYNCHRONIZED',
      storageEngine: 'IndexedDB+LocalStorage',
      lastOperationLatencyMs: this.lastLatencyMs,
    };
  }
}

export const memoryEngine = new MemoryEngine();
