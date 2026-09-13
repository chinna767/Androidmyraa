import { MemoryCategory } from '../../types';

export interface ScoreBreakdown {
  importance: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  factors: {
    categoryWeight: number;
    explicitnessBoost: number;
    permanenceWeight: number;
    linguisticConfidence: number;
  };
}

export class MemoryScorer {
  /**
   * Evaluates importance score (0.0 to 1.0)
   */
  public static calculateImportance(
    category: MemoryCategory,
    statement: string,
    isExplicit: boolean
  ): number {
    if (isExplicit) {
      return 1.0; // User explicitly instructed to remember this
    }

    const lower = statement.toLowerCase();

    // Category base weight
    let baseScore = 0.6;
    switch (category.toUpperCase()) {
      case 'IDENTITY':
        baseScore = 0.98;
        break;
      case 'RELATIONSHIPS':
        baseScore = 0.95;
        break;
      case 'GOALS':
      case 'PROJECTS':
        baseScore = 0.90;
        break;
      case 'PREFERENCES':
      case 'PREFERENCE':
        baseScore = 0.85;
        break;
      case 'HABITS':
      case 'INTERESTS':
        baseScore = 0.75;
        break;
      case 'LIFE_EVENTS':
        baseScore = 0.80;
        break;
      case 'CONVERSATIONAL_PREFERENCES':
        baseScore = 0.85;
        break;
      default:
        baseScore = 0.60;
    }

    // Keyword permanence cues
    if (/(favorite|always|never|every\s+day|love|hate|dream|aspire|building|career)/i.test(lower)) {
      baseScore = Math.min(1.0, baseScore + 0.1);
    }

    // Temporary/transient penalties
    if (/(today|right\s+now|currently\s+eating|drinking|this\s+moment|just\s+now)/i.test(lower)) {
      baseScore = Math.max(0.2, baseScore - 0.35);
    }

    return Math.round(baseScore * 100) / 100;
  }

  /**
   * Evaluates confidence score (0.0 to 1.0) based on linguistic certainty
   */
  public static calculateConfidence(statement: string, isExplicit: boolean): number {
    if (isExplicit) return 1.0;

    const lower = statement.toLowerCase();

    // Speculative or uncertain signals
    if (/(i\s+think|maybe|might|probably|could\s+be|not\s+sure|i\s+guess|somewhat)/i.test(lower)) {
      return 0.45;
    }

    // Strong declarative signals
    if (/(my\s+name\s+is|i\s+am|i\s+always|definitely|absolutely|my\s+favorite|i\s+love)/i.test(lower)) {
      return 0.95;
    }

    // Moderate declarative signals
    return 0.80;
  }

  /**
   * Determines if a candidate is strong enough for automatic long-term persistence
   */
  public static isEligibleForAutoPersistence(importance: number, confidence: number): boolean {
    // Threshold: only persist automatically if importance >= 0.70 and confidence >= 0.75
    return importance >= 0.70 && confidence >= 0.75;
  }
}
