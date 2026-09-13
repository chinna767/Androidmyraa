import { ContactRecord } from '../../types';
import { memoryEngine } from '../MemoryEngine';

export class ContactManager {
  private static instance: ContactManager | null = null;
  private contacts: Map<string, ContactRecord> = new Map();

  private constructor() {
    this.initializeDefaultContacts();
  }

  public static getInstance(): ContactManager {
    if (!ContactManager.instance) {
      ContactManager.instance = new ContactManager();
    }
    return ContactManager.instance;
  }

  /**
   * Initialize local contacts cache.
   * In a native Android build, this is synchronized with Android Contacts Provider (READ_CONTACTS).
   */
  private initializeDefaultContacts(): void {
    const defaultContacts: ContactRecord[] = [
      {
        id: 'c-mom',
        name: 'Mom',
        normalizedName: 'mom',
        phoneNumber: '+91 98765 43210',
        relationship: 'Mother',
        isFavorite: true,
      },
      {
        id: 'c-dad',
        name: 'Dad',
        normalizedName: 'dad',
        phoneNumber: '+91 98765 43211',
        relationship: 'Father',
        isFavorite: true,
      },
      {
        id: 'c-rahul',
        name: 'Rahul',
        normalizedName: 'rahul',
        phoneNumber: '+91 98123 45678',
        relationship: 'Friend',
        isFavorite: true,
      },
      {
        id: 'c-john-k',
        name: 'John Kumar',
        normalizedName: 'john kumar',
        phoneNumber: '+91 97654 32109',
        relationship: 'Colleague',
      },
      {
        id: 'c-john-r',
        name: 'John Reddy',
        normalizedName: 'john reddy',
        phoneNumber: '+91 97654 32110',
        relationship: 'Friend',
      },
      {
        id: 'c-priya',
        name: 'Priya',
        normalizedName: 'priya',
        phoneNumber: '+91 96543 21098',
        relationship: 'Sister',
      },
      {
        id: 'c-brother',
        name: 'Suresh',
        normalizedName: 'suresh',
        phoneNumber: '+91 95432 10987',
        relationship: 'Brother',
      },
    ];

    defaultContacts.forEach((c) => this.contacts.set(c.id, c));

    // Try synchronizing with native Android bridge if available
    if (typeof window !== 'undefined' && (window as any).AndroidContactBridge?.getContactsJson) {
      try {
        const rawJson = (window as any).AndroidContactBridge.getContactsJson();
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item.name && item.phoneNumber) {
              const record: ContactRecord = {
                id: item.id || `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                name: item.name,
                normalizedName: item.name.toLowerCase().trim(),
                phoneNumber: item.phoneNumber,
                relationship: item.relationship,
                isFavorite: item.isFavorite,
              };
              this.contacts.set(record.id, record);
            }
          });
        }
      } catch (err) {
        console.warn('[ContactManager] Native contacts bridge sync warning:', err);
      }
    }
  }

  /**
   * Get all local contacts safely (kept strictly on-device, never sent in bulk to Gemini).
   */
  public getAllContacts(): ContactRecord[] {
    return Array.from(this.contacts.values());
  }

  /**
   * Find contact by ID
   */
  public getContactById(id: string): ContactRecord | undefined {
    return this.contacts.get(id);
  }

  /**
   * Find contact by phone number (for incoming caller identification)
   */
  public findContactByPhoneNumber(phoneNumber: string): ContactRecord | undefined {
    const cleanQuery = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanQuery) return undefined;

    for (const contact of this.contacts.values()) {
      const cleanContactNum = contact.phoneNumber.replace(/[^0-9]/g, '');
      // Match exact or last 10 digits
      if (
        cleanContactNum === cleanQuery ||
        (cleanContactNum.length >= 10 && cleanQuery.length >= 10 && cleanContactNum.slice(-10) === cleanQuery.slice(-10))
      ) {
        return contact;
      }
    }
    return undefined;
  }

  /**
   * Check if user has explicit relationship memories (e.g. "Mom is my mother")
   */
  public getRelationshipAlias(relationshipQuery: string): ContactRecord | undefined {
    const q = relationshipQuery.toLowerCase().trim();

    // Check relationship field on contacts
    for (const contact of this.contacts.values()) {
      if (contact.relationship && contact.relationship.toLowerCase() === q) {
        return contact;
      }
    }

    // Check MemoryEngine relationships category
    const memories = memoryEngine.getAllMemories().filter((m) => m.category === 'RELATIONSHIPS' || m.category === 'IDENTITY' || m.category === 'LIFE_EVENTS');
    for (const mem of memories) {
      if (mem.key.toLowerCase().includes(q) || mem.value.toLowerCase().includes(q)) {
        // Look up corresponding contact
        for (const contact of this.contacts.values()) {
          if (
            mem.value.toLowerCase().includes(contact.normalizedName) ||
            mem.key.toLowerCase().includes(contact.normalizedName)
          ) {
            return contact;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Add or update contact locally
   */
  public saveContact(contact: ContactRecord): void {
    this.contacts.set(contact.id, contact);
  }
}

export const contactManager = ContactManager.getInstance();
