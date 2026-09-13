import { ContactRecord } from '../../types';
import { contactManager } from './ContactManager';

export interface ContactResolutionResult {
  status: 'RESOLVED' | 'AMBIGUOUS' | 'NOT_FOUND';
  contact?: ContactRecord;
  matches?: ContactRecord[];
  disambiguationPrompt?: string;
  originalQuery: string;
}

export class ContactResolver {
  private static instance: ContactResolver | null = null;

  private constructor() {}

  public static getInstance(): ContactResolver {
    if (!ContactResolver.instance) {
      ContactResolver.instance = new ContactResolver();
    }
    return ContactResolver.instance;
  }

  /**
   * Resolve a contact name or relationship alias locally on device.
   * Gemini provides only the raw contact_name. All resolution occurs strictly on-device.
   */
  public resolveContact(rawQuery: string): ContactResolutionResult {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      return {
        status: 'NOT_FOUND',
        originalQuery: rawQuery,
      };
    }

    // Clean prefix variations like "my mom", "call mom", "please call Rahul", "friend Rahul"
    const cleaned = trimmed
      .toLowerCase()
      .replace(/^(please\s+|can\s+you\s+|i\s+want\s+to\s+|my\s+)/i, '')
      .replace(/^(friend\s+|brother\s+|sister\s+|colleague\s+)/i, '')
      .trim();

    const allContacts = contactManager.getAllContacts();

    // 1. Direct exact name match
    const exactMatches = allContacts.filter(
      (c) => c.normalizedName === cleaned || c.name.toLowerCase() === cleaned
    );
    if (exactMatches.length === 1) {
      return {
        status: 'RESOLVED',
        contact: exactMatches[0],
        originalQuery: rawQuery,
      };
    }

    // 2. Relationship alias resolution (e.g. "mom", "dad", "brother", "sister", "wife")
    const relMatch = contactManager.getRelationshipAlias(cleaned);
    if (relMatch) {
      return {
        status: 'RESOLVED',
        contact: relMatch,
        originalQuery: rawQuery,
      };
    }

    // 3. Prefix/First-name match
    const prefixMatches = allContacts.filter((c) => {
      const parts = c.normalizedName.split(/\s+/);
      return (
        c.normalizedName.startsWith(cleaned) ||
        parts.some((part) => part === cleaned || part.startsWith(cleaned))
      );
    });

    if (prefixMatches.length === 1) {
      return {
        status: 'RESOLVED',
        contact: prefixMatches[0],
        originalQuery: rawQuery,
      };
    }

    if (prefixMatches.length > 1) {
      const namesList = prefixMatches.map((c) => c.name).join(' and ');
      return {
        status: 'AMBIGUOUS',
        matches: prefixMatches,
        disambiguationPrompt: `I found multiple contacts for ${trimmed} (${namesList}). Which one do you mean, Chinna?`,
        originalQuery: rawQuery,
      };
    }

    // 4. Substring containment match
    const substringMatches = allContacts.filter((c) =>
      c.normalizedName.includes(cleaned) || cleaned.includes(c.normalizedName)
    );

    if (substringMatches.length === 1) {
      return {
        status: 'RESOLVED',
        contact: substringMatches[0],
        originalQuery: rawQuery,
      };
    }

    if (substringMatches.length > 1) {
      const namesList = substringMatches.map((c) => c.name).join(' and ');
      return {
        status: 'AMBIGUOUS',
        matches: substringMatches,
        disambiguationPrompt: `I found ${substringMatches.length} contacts matching "${trimmed}" (${namesList}). Which one would you like to call, Chinna?`,
        originalQuery: rawQuery,
      };
    }

    return {
      status: 'NOT_FOUND',
      originalQuery: rawQuery,
    };
  }
}

export const contactResolver = ContactResolver.getInstance();
