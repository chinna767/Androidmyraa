import { MemorySensitivity, MemoryCandidate } from '../../types';

export class MemoryPrivacyManager {
  private static readonly SENSITIVE_PATTERNS = [
    // Passwords & PINs
    /(?:password|passwd|pin\s*code|secret\s*key|access\s*token)\s*(?:is|=|:)\s*([^\s,;]+)/i,
    // Credit card patterns (13-19 digits)
    /\b(?:\d[ -]*?){13,19}\b/,
    // SSN patterns
    /\b\d{3}-\d{2}-\d{4}\b/,
    // API keys (e.g. AIza..., sk-..., etc.)
    /\b(?:AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{20,})\b/,
  ];

  /**
   * Checks if candidate content contains blocked sensitive information
   */
  public static evaluateSensitivity(text: string): {
    isBlocked: boolean;
    sensitivity: MemorySensitivity;
    reason?: string;
  } {
    for (const pattern of this.SENSITIVE_PATTERNS) {
      if (pattern.test(text)) {
        return {
          isBlocked: true,
          sensitivity: 'HIGH',
          reason: 'Statement contains restricted credentials, payment, or authentication data.',
        };
      }
    }

    // Health or private sensitive items get MEDIUM sensitivity
    if (/(medical|doctor|prescription|financial|salary|bank)/i.test(text)) {
      return {
        isBlocked: false,
        sensitivity: 'MEDIUM',
      };
    }

    return {
      isBlocked: false,
      sensitivity: 'LOW',
    };
  }

  /**
   * Sanitizes text to remove any accidentally leaked secret patterns before context building
   */
  public static sanitizeForContext(text: string): string {
    let sanitized = text;
    for (const pattern of this.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }
}
