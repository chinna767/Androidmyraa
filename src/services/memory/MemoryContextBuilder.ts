import { MemoryEntity } from '../../types';
import { MemoryPrivacyManager } from './MemoryPrivacyManager';

export class MemoryContextBuilder {
  /**
   * Converts a collection of active, relevant memory entities into concise natural language statements for Gemini context.
   */
  public static buildPromptContext(memories: MemoryEntity[]): string {
    if (!memories || memories.length === 0) {
      return '';
    }

    const lines: string[] = [];

    for (const mem of memories) {
      if (mem.status !== 'ACTIVE') continue;

      const sanitizedVal = MemoryPrivacyManager.sanitizeForContext(mem.value);

      if (mem.category === 'IDENTITY') {
        lines.push(`- User Identity: The user's name is ${sanitizedVal}. Address him naturally as Chinna.`);
      } else if (mem.category === 'RELATIONSHIPS') {
        lines.push(`- Relationship: ${sanitizedVal}`);
      } else if (mem.category === 'PREFERENCES') {
        lines.push(`- Preference: ${sanitizedVal}`);
      } else if (mem.category === 'PROJECTS') {
        lines.push(`- Project: ${sanitizedVal}`);
      } else if (mem.category === 'GOALS') {
        lines.push(`- Goal: ${sanitizedVal}`);
      } else if (mem.category === 'HABITS') {
        lines.push(`- Habit/Routine: ${sanitizedVal}`);
      } else if (mem.category === 'CONVERSATIONAL_PREFERENCES') {
        lines.push(`- Conversational Style: ${sanitizedVal}`);
      } else {
        lines.push(`- Fact: ${sanitizedVal}`);
      }
    }

    if (lines.length === 0) return '';

    return `\n### RELEVANT PERSISTENT MEMORIES WITH CHINNA:\n${lines.join('\n')}\n*Use these memories naturally when relevant to the conversation. Do not say "According to my database" or "I searched your memories". Simply talk with natural familiarity.*`;
  }
}
