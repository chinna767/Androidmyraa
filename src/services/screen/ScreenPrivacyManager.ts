import { MemoryCategory } from '../../types';

export class ScreenPrivacyManager {
  private static instance: ScreenPrivacyManager | null = null;

  private constructor() {}

  public static getInstance(): ScreenPrivacyManager {
    if (!ScreenPrivacyManager.instance) {
      ScreenPrivacyManager.instance = new ScreenPrivacyManager();
    }
    return ScreenPrivacyManager.instance;
  }

  /**
   * Sanitizes sensitive text (e.g. API keys, passwords) from debug logs.
   */
  public sanitizeLogMessage(message: string): string {
    return message
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
      .replace(/sk-[a-zA-Z0-9]{32,}/g, '[REDACTED_SECRET]')
      .replace(/password\s*[:=]\s*['"][^'"]+['"]/gi, 'password: "[REDACTED]"')
      .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'bearer [REDACTED_TOKEN]');
  }

  /**
   * Checks if an explicit user request should be stored in persistent long-term memory.
   * By default, raw screen frames and casual website visits are NEVER stored in memory.
   */
  public validateMemoryStoragePermission(
    userSpokenText: string,
    extractedFact: string
  ): { isAllowed: boolean; category: MemoryCategory; reason: string } {
    const lower = userSpokenText.toLowerCase();

    // Check if the user explicitly asked to remember something
    const isExplicitRemember =
      lower.includes('remember') ||
      lower.includes('save this to memory') ||
      lower.includes("don't forget that this is") ||
      lower.includes('keep in mind');

    if (!isExplicitRemember) {
      return {
        isAllowed: false,
        category: 'PREFERENCES',
        reason: 'Screen content is temporary context by default and was not explicitly requested to be remembered.',
      };
    }

    if (lower.includes('project') || lower.includes('source code') || lower.includes('building') || lower.includes('app')) {
      return {
        isAllowed: true,
        category: 'PROJECTS',
        reason: 'User explicitly requested to remember project/code context.',
      };
    }

    return {
      isAllowed: true,
      category: 'PREFERENCES',
      reason: 'User explicitly requested to remember fact from screen.',
    };
  }
}

export const screenPrivacyManager = ScreenPrivacyManager.getInstance();
