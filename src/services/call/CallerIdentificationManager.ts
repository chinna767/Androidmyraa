import { ContactRecord } from '../../types';
import { contactManager } from './ContactManager';

export interface CallerIdentificationResult {
  isKnown: boolean;
  callerName?: string;
  contact?: ContactRecord;
  formattedAnnouncement: string;
  maskedPhoneNumber: string;
  rawPhoneNumber: string;
}

export class CallerIdentificationManager {
  private static instance: CallerIdentificationManager | null = null;

  private constructor() {}

  public static getInstance(): CallerIdentificationManager {
    if (!CallerIdentificationManager.instance) {
      CallerIdentificationManager.instance = new CallerIdentificationManager();
    }
    return CallerIdentificationManager.instance;
  }

  /**
   * Mask a phone number for safe logging and telemetry (e.g. "+91 98*** **321")
   */
  public maskPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.trim();
    if (cleaned.length <= 4) return '****';
    const firstPart = cleaned.slice(0, 4);
    const lastPart = cleaned.slice(-3);
    return `${firstPart}*** **${lastPart}`;
  }

  /**
   * Identifies an incoming caller number against local contacts and formats MYRAA's announcement.
   */
  public identifyCaller(phoneNumber: string, askBeforeAnswering = true): CallerIdentificationResult {
    const contact = contactManager.findContactByPhoneNumber(phoneNumber);
    const maskedPhoneNumber = this.maskPhoneNumber(phoneNumber);

    if (contact) {
      const name = contact.relationship === 'Mother' ? 'Mom' : contact.relationship === 'Father' ? 'Dad' : contact.name;
      const questionSuffix = askBeforeAnswering ? ' Do you want to pick up?' : '';
      const announcement = `Chinna, ${name} is calling you.${questionSuffix}`;

      return {
        isKnown: true,
        callerName: contact.name,
        contact,
        formattedAnnouncement: announcement,
        maskedPhoneNumber,
        rawPhoneNumber: phoneNumber,
      };
    }

    // Unknown caller
    const questionSuffix = askBeforeAnswering ? ' Do you want to answer?' : '';
    const announcement = `Chinna, you've got an incoming call from an unknown number.${questionSuffix}`;

    return {
      isKnown: false,
      callerName: undefined,
      contact: undefined,
      formattedAnnouncement: announcement,
      maskedPhoneNumber,
      rawPhoneNumber: phoneNumber,
    };
  }
}

export const callerIdentificationManager = CallerIdentificationManager.getInstance();
