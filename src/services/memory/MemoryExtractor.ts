import { MemoryCandidate, MemoryCategory } from '../../types';
import { MemoryScorer } from './MemoryScorer';
import { MemoryPrivacyManager } from './MemoryPrivacyManager';

export interface ExtractorResult {
  isExplicitRemember: boolean;
  isExplicitForget: boolean;
  forgetKeyword?: string;
  candidate?: MemoryCandidate;
  explanation?: string;
}

export class MemoryExtractor {
  /**
   * Analyzes an incoming user utterance for explicit memory commands or natural candidates.
   */
  public static extract(userText: string): ExtractorResult {
    if (!userText || userText.trim().length === 0) {
      return { isExplicitRemember: false, isExplicitForget: false };
    }

    const trimmed = userText.trim();
    const lower = trimmed.toLowerCase();

    // 1. Explicit FORGET commands
    // e.g. "Forget that my favorite game is Minecraft", "Forget my favorite game", "Delete that memory", "Don't remember that anymore"
    if (
      lower.startsWith('forget that') ||
      lower.startsWith('forget my') ||
      lower.startsWith('forget what i') ||
      lower.startsWith("don't remember this") ||
      lower.startsWith("don't remember that") ||
      lower.startsWith('delete memory') ||
      lower.startsWith('delete that memory') ||
      lower.includes('forget that')
    ) {
      const keyword = lower
        .replace(/^(?:hey\s+myraa,?\s*)?(?:please\s+)?(?:forget\s+(?:that|what\s+i\s+told\s+you\s+about|what\s+i\s+said\s+about|my)?|don't\s+remember\s+(?:this|that|about|my)?|delete\s+(?:that\s+)?memory(?:\s+about)?)\s*/i, '')
        .trim();

      return {
        isExplicitRemember: false,
        isExplicitForget: true,
        forgetKeyword: keyword.length > 0 ? keyword : trimmed,
        explanation: 'User explicitly requested to forget a memory.',
      };
    }

    // 2. Explicit REMEMBER commands
    // e.g. "Remember that my favorite game is Minecraft", "Please remember that I am building MYRAA", "Save this: my birthday is June 5"
    const explicitMatch = lower.match(
      /^(?:hey\s+myraa,?\s*)?(?:please\s+)?(?:remember\s+(?:that|this:?|)|save\s+(?:this:?|that:?)|don't\s+forget\s+(?:that|this:?)|keep\s+in\s+memory\s+(?:that|this:?))\s+(.+)$/i
    );

    if (explicitMatch && explicitMatch[1]) {
      const rawFact = explicitMatch[1].trim();
      const privacy = MemoryPrivacyManager.evaluateSensitivity(rawFact);
      if (privacy.isBlocked) {
        return {
          isExplicitRemember: false,
          isExplicitForget: false,
          explanation: privacy.reason,
        };
      }

      const { category, key, value, expirationAt } = this.parseFactDetails(rawFact, true);
      const importance = MemoryScorer.calculateImportance(category, rawFact, true);
      const confidence = MemoryScorer.calculateConfidence(rawFact, true);

      return {
        isExplicitRemember: true,
        isExplicitForget: false,
        candidate: {
          category,
          key,
          value,
          normalizedValue: value.toLowerCase().trim(),
          rawStatement: trimmed,
          importance,
          confidence,
          source: 'EXPLICIT',
          expirationAt,
          sensitivity: privacy.sensitivity,
          isExplicit: true,
        },
      };
    }

    // 3. Automatic candidate extraction for natural conversational facts
    return this.extractAutomaticCandidate(trimmed, lower);
  }

  private static extractAutomaticCandidate(trimmed: string, lower: string): ExtractorResult {
    // Check privacy
    const privacy = MemoryPrivacyManager.evaluateSensitivity(trimmed);
    if (privacy.isBlocked) {
      return { isExplicitRemember: false, isExplicitForget: false };
    }

    // A. Favorite Games, Music, Movies, Foods
    const favMatch = lower.match(
      /(?:my\s+favorite|i\s+really\s+love|i\s+love\s+playing|i\s+love\s+listening\s+to|i\s+love\s+eating)\s+(?:game|song|music|movie|food|color|dish|sport)?\s*(?:is|are)?\s*(.+)/i
    );
    if (favMatch && favMatch[1]) {
      // Avoid temporary sentences like "I love that idea"
      if (!/(that\s+idea|this|it|you|what\s+you\s+did)/i.test(favMatch[1])) {
        const { category, key, value } = this.parseFactDetails(trimmed, false);
        const importance = MemoryScorer.calculateImportance(category, trimmed, false);
        const confidence = MemoryScorer.calculateConfidence(trimmed, false);

        if (MemoryScorer.isEligibleForAutoPersistence(importance, confidence)) {
          return {
            isExplicitRemember: false,
            isExplicitForget: false,
            candidate: {
              category,
              key,
              value,
              normalizedValue: value.toLowerCase().trim(),
              rawStatement: trimmed,
              importance,
              confidence,
              source: 'AUTOMATIC',
              sensitivity: privacy.sensitivity,
              isExplicit: false,
            },
          };
        }
      }
    }

    // B. Projects / Work ("I've been working on MYRAA for the last few months", "I am building an app called...")
    if (
      /(?:working\s+on|building|developing|creating\s+a\s+project|my\s+project\s+is)\s+(.+)/i.test(lower) &&
      !/(nothing|now|homework|this\s+issue|a\s+bug)/i.test(lower)
    ) {
      const { category, key, value } = this.parseFactDetails(trimmed, false);
      const importance = MemoryScorer.calculateImportance(category, trimmed, false);
      const confidence = MemoryScorer.calculateConfidence(trimmed, false);

      if (MemoryScorer.isEligibleForAutoPersistence(importance, confidence)) {
        return {
          isExplicitRemember: false,
          isExplicitForget: false,
          candidate: {
            category,
            key,
            value,
            normalizedValue: value.toLowerCase().trim(),
            rawStatement: trimmed,
            importance,
            confidence,
            source: 'AUTOMATIC',
            sensitivity: privacy.sensitivity,
            isExplicit: false,
          },
        };
      }
    }

    // C. Goals & Ambitions ("My goal is to learn Kotlin", "I want to become an Android developer")
    if (/(?:my\s+goal\s+is\s+to|i\s+want\s+to\s+become|i\s+aspire\s+to|aiming\s+to)\s+(.+)/i.test(lower)) {
      const { category, key, value } = this.parseFactDetails(trimmed, false);
      const importance = MemoryScorer.calculateImportance(category, trimmed, false);
      const confidence = MemoryScorer.calculateConfidence(trimmed, false);

      if (MemoryScorer.isEligibleForAutoPersistence(importance, confidence)) {
        return {
          isExplicitRemember: false,
          isExplicitForget: false,
          candidate: {
            category,
            key,
            value,
            normalizedValue: value.toLowerCase().trim(),
            rawStatement: trimmed,
            importance,
            confidence,
            source: 'AUTOMATIC',
            sensitivity: privacy.sensitivity,
            isExplicit: false,
          },
        };
      }
    }

    return { isExplicitRemember: false, isExplicitForget: false };
  }

  private static parseFactDetails(
    fact: string,
    isExplicit: boolean
  ): { category: MemoryCategory; key: string; value: string; expirationAt?: string } {
    const lower = fact.toLowerCase();
    let category: MemoryCategory = 'PREFERENCES';
    let key = 'user_preference';
    let value = fact;
    let expirationAt: string | undefined = undefined;

    // Temporary memory check (e.g. "studying for exam this week", "travelling tomorrow")
    if (/(this\s+week|tomorrow|next\s+week|exam|test\s+on\s+friday|today)/i.test(lower)) {
      const oneWeekLater = new Date();
      oneWeekLater.setDate(oneWeekLater.getDate() + 7);
      expirationAt = oneWeekLater.toISOString();
    }

    // Categorization
    if (/(name|call\s+me|identity)/i.test(lower)) {
      category = 'IDENTITY';
      key = 'user_name';
      const nameMatch = fact.match(/(?:name\s+is|call\s+me|i'm|i\s+am)\s+([A-Za-z]+)/i);
      if (nameMatch) {
        value = nameMatch[1].trim();
      }
    } else if (/(game|play|minecraft|pubg|valorant|chess|gta)/i.test(lower)) {
      category = 'PREFERENCES';
      key = 'favorite_game';
      const gameMatch = fact.match(/(?:favorite\s+game\s+is|love\s+playing|game\s+is|play)\s+([A-Za-z0-9\s]+)/i);
      if (gameMatch) {
        value = gameMatch[1].trim();
      }
    } else if (/(song|music|singer|band|melody|track|album)/i.test(lower)) {
      category = 'PREFERENCES';
      key = 'favorite_music';
      const musicMatch = fact.match(/(?:favorite\s+music|song|singer|band\s+is|listen\s+to)\s+([A-Za-z0-9\s]+)/i);
      if (musicMatch) {
        value = musicMatch[1].trim();
      }
    } else if (/(food|dish|biryani|eat|cuisine|coffee|tea|drink)/i.test(lower)) {
      category = 'PREFERENCES';
      key = 'favorite_food_or_drink';
      const foodMatch = fact.match(/(?:favorite\s+food|drink|dish\s+is|love\s+eating)\s+([A-Za-z0-9\s]+)/i);
      if (foodMatch) {
        value = foodMatch[1].trim();
      }
    } else if (/(build|project|myraa|app|code|software|develop|website|startup)/i.test(lower)) {
      category = 'PROJECTS';
      key = 'current_project';
      value = fact.replace(/^(?:i'm|i\s+am)\s+(?:building|working\s+on)\s+/i, '').trim();
    } else if (/(goal|aim|dream|aspire|become|future)/i.test(lower)) {
      category = 'GOALS';
      key = 'primary_goal';
      value = fact;
    } else if (/(routine|usually|every\s+day|habit|morning|night)/i.test(lower)) {
      category = 'HABITS';
      key = 'daily_routine';
      value = fact;
    } else if (/(friend|sister|brother|mom|dad|family|creator|relationship)/i.test(lower)) {
      category = 'RELATIONSHIPS';
      key = 'relationship_detail';
      value = fact;
    }

    // Capitalize first letter of value if needed
    if (value.length > 0) {
      value = value.charAt(0).toUpperCase() + value.slice(1);
    }

    return { category, key, value, expirationAt };
  }
}
