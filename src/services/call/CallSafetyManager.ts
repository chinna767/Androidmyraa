import { ContactRecord, CallExecutionStatus } from '../../types';
import { callerIdentificationManager } from './CallerIdentificationManager';

export interface CallSafetyEvaluation {
  allowed: boolean;
  status?: CallExecutionStatus;
  reason?: string;
  sanitizedMessage?: string;
}

export class CallSafetyManager {
  private static instance: CallSafetyManager | null = null;

  private constructor() {}

  public static getInstance(): CallSafetyManager {
    if (!CallSafetyManager.instance) {
      CallSafetyManager.instance = new CallSafetyManager();
    }
    return CallSafetyManager.instance;
  }

  /**
   * Validate outgoing call safety before dialing
   */
  public evaluateOutgoingCall(contact?: ContactRecord, isAmbiguous = false): CallSafetyEvaluation {
    if (isAmbiguous) {
      return {
        allowed: false,
        status: 'AMBIGUOUS_CONTACT',
        reason: 'Cannot initiate call to an ambiguous contact without explicit disambiguation.',
      };
    }

    if (!contact) {
      return {
        allowed: false,
        status: 'CONTACT_NOT_FOUND',
        reason: 'Contact does not exist in local address book.',
      };
    }

    if (!contact.phoneNumber || contact.phoneNumber.trim().length < 3) {
      return {
        allowed: false,
        status: 'CALL_FAILED',
        reason: 'Contact does not have a valid telephone number.',
      };
    }

    return {
      allowed: true,
      sanitizedMessage: `Safe to initiate outgoing call to ${contact.name}`,
    };
  }

  /**
   * Sanitize log messages to prevent leaking full phone numbers or private data
   */
  public sanitizeLog(message: string): string {
    // Mask potential phone numbers (e.g. +91 98765 43210 or 9876543210)
    return message.replace(/(\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, (match) => {
      return callerIdentificationManager.maskPhoneNumber(match);
    });
  }
}

export const callSafetyManager = CallSafetyManager.getInstance();
