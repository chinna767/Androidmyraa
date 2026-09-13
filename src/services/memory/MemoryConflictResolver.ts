import { MemoryCandidate, MemoryEntity } from '../../types';
import { MemoryRepository } from './MemoryRepository';

export type ResolutionAction = 'CREATE_NEW' | 'UPDATE_EXISTING' | 'REJECT_CONFLICT';

export interface ConflictResolution {
  action: ResolutionAction;
  targetEntity?: MemoryEntity;
  updatedEntity?: MemoryEntity;
  reason: string;
}

export class MemoryConflictResolver {
  public static async resolve(
    candidate: MemoryCandidate,
    repository: MemoryRepository
  ): Promise<ConflictResolution> {
    const activeMemories = repository.getAllActiveMemories();
    const candidateKey = candidate.key.toLowerCase().trim();

    // 1. Direct key match
    const existing = activeMemories.find((m) => m.key.toLowerCase().trim() === candidateKey);

    if (existing) {
      // If the value is already identical, skip/no-op
      if (existing.normalizedValue === candidate.normalizedValue) {
        return {
          action: 'REJECT_CONFLICT',
          reason: 'Identical memory already exists with same key and value.',
        };
      }

      // Check if existing memory has higher confidence and candidate is speculative
      if (existing.confidence >= 0.9 && candidate.confidence < 0.6 && !candidate.isExplicit) {
        return {
          action: 'REJECT_CONFLICT',
          reason: `Existing high-confidence memory (${existing.value}) preferred over uncertain candidate.`,
        };
      }

      // Explicit update or newer confident statement -> UPDATE existing entity
      const updated: MemoryEntity = {
        ...existing,
        value: candidate.value,
        normalizedValue: candidate.normalizedValue,
        importance: Math.max(existing.importance, candidate.importance),
        confidence: candidate.isExplicit ? 1.0 : candidate.confidence,
        updatedAt: new Date().toISOString(),
        source: candidate.source,
        version: (existing.version || 1) + 1,
        expirationAt: candidate.expirationAt,
        status: 'ACTIVE',
      };

      return {
        action: 'UPDATE_EXISTING',
        targetEntity: existing,
        updatedEntity: updated,
        reason: `Updated ${existing.key} from "${existing.value}" to "${candidate.value}" (confidence: ${candidate.confidence}).`,
      };
    }

    // 2. Semantic key overlap (e.g. "favorite_videogame" vs "favorite_game")
    for (const mem of activeMemories) {
      if (this.areKeysSemanticallyEquivalent(mem.key, candidate.key)) {
        if (candidate.isExplicit || candidate.confidence >= mem.confidence) {
          const updated: MemoryEntity = {
            ...mem,
            value: candidate.value,
            normalizedValue: candidate.normalizedValue,
            importance: Math.max(mem.importance, candidate.importance),
            confidence: candidate.confidence,
            updatedAt: new Date().toISOString(),
            source: candidate.source,
            version: (mem.version || 1) + 1,
            status: 'ACTIVE',
          };
          return {
            action: 'UPDATE_EXISTING',
            targetEntity: mem,
            updatedEntity: updated,
            reason: `Updated equivalent key ${mem.key} to "${candidate.value}".`,
          };
        }
      }
    }

    // 3. No conflict found -> Create new
    return {
      action: 'CREATE_NEW',
      reason: 'No existing conflict, creating new memory entity.',
    };
  }

  private static areKeysSemanticallyEquivalent(keyA: string, keyB: string): boolean {
    const k1 = keyA.toLowerCase().replace(/[^a-z0-9]/g, '');
    const k2 = keyB.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (k1 === k2) return true;

    // Check specific synonyms
    if (
      (k1.includes('game') && k2.includes('game')) ||
      (k1.includes('song') && k2.includes('music')) ||
      (k1.includes('music') && k2.includes('song')) ||
      (k1.includes('food') && k2.includes('dish')) ||
      (k1.includes('project') && k2.includes('project'))
    ) {
      if (k1.includes('favorite') && k2.includes('favorite')) return true;
      if (k1.includes('current') && k2.includes('current')) return true;
    }

    return false;
  }
}
