import { MemoryCategory, MemorySensitivity, MemoryCandidate, MemoryEntity } from '../../types';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  sanitizedCandidate?: MemoryCandidate;
}

export class MemoryValidator {
  private static readonly VALID_CATEGORIES: Set<string> = new Set([
    'IDENTITY',
    'PREFERENCES',
    'INTERESTS',
    'GOALS',
    'PROJECTS',
    'HABITS',
    'RELATIONSHIPS',
    'LIFE_EVENTS',
    'CONVERSATIONAL_PREFERENCES',
    'Preference',
    'Goal',
    'Project',
    'Habit',
    'Schedule',
    'Relationship',
    'Interest',
    'Important Fact',
    'Conversation',
    'Instruction',
    'Personal Detail',
  ]);

  public static validateCandidate(candidate: Partial<MemoryCandidate>): ValidationResult {
    if (!candidate.key || candidate.key.trim().length === 0) {
      return { isValid: false, reason: 'Memory key is empty' };
    }

    if (!candidate.value || candidate.value.trim().length === 0) {
      return { isValid: false, reason: 'Memory value is empty' };
    }

    const trimmedValue = candidate.value.trim();
    if (trimmedValue.length < 2) {
      return { isValid: false, reason: 'Memory value too short' };
    }

    // Ban generic noise or single filler words
    if (/^(yes|no|okay|ok|sure|hmm|yeah|nah|yep|maybe|true|false)$/i.test(trimmedValue)) {
      return { isValid: false, reason: 'Memory value is a generic filler word' };
    }

    const category = candidate.category || 'PREFERENCES';
    if (!this.VALID_CATEGORIES.has(category)) {
      return { isValid: false, reason: `Invalid memory category: ${category}` };
    }

    const importance = Math.max(0.0, Math.min(1.0, candidate.importance ?? 0.7));
    const confidence = Math.max(0.0, Math.min(1.0, candidate.confidence ?? 0.8));

    const sanitized: MemoryCandidate = {
      category: category as MemoryCategory,
      key: candidate.key.trim().toLowerCase().replace(/\s+/g, '_'),
      value: trimmedValue,
      normalizedValue: candidate.normalizedValue || trimmedValue.toLowerCase().trim(),
      rawStatement: candidate.rawStatement || trimmedValue,
      importance,
      confidence,
      source: candidate.source || 'AUTOMATIC',
      expirationAt: candidate.expirationAt,
      sensitivity: (candidate.sensitivity as MemorySensitivity) || 'LOW',
      isExplicit: candidate.isExplicit ?? false,
    };

    return { isValid: true, sanitizedCandidate: sanitized };
  }

  public static validateEntity(entity: Partial<MemoryEntity>): boolean {
    if (!entity.memoryId && !entity.id) return false;
    if (!entity.key || entity.key.trim().length === 0) return false;
    if (!entity.value || entity.value.trim().length === 0) return false;
    return true;
  }
}
