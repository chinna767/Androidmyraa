import { CallExecutionStatus, ContactRecord } from '../../types';
import { contactResolver } from './ContactResolver';
import { callPermissionManager } from './CallPermissionManager';
import { callSafetyManager } from './CallSafetyManager';
import { callStateManager } from './CallStateManager';

export interface OutgoingCallResult {
  status: CallExecutionStatus;
  naturalResponse: string;
  contact?: ContactRecord;
  requiresConfirmation?: boolean;
}

export class OutgoingCallManager {
  private static instance: OutgoingCallManager | null = null;
  private confirmOutgoingCalls = true;

  private constructor() {}

  public static getInstance(): OutgoingCallManager {
    if (!OutgoingCallManager.instance) {
      OutgoingCallManager.instance = new OutgoingCallManager();
    }
    return OutgoingCallManager.instance;
  }

  public setConfirmOutgoingCalls(enabled: boolean): void {
    this.confirmOutgoingCalls = enabled;
  }

  public getConfirmOutgoingCalls(): boolean {
    return this.confirmOutgoingCalls;
  }

  /**
   * Step 1: Initiate an outgoing call request from user voice or Gemini tool call.
   */
  public async requestCall(contactQuery: string): Promise<OutgoingCallResult> {
    // 1. Permission check
    const perm = callPermissionManager.canMakeOutgoingCalls();
    if (!perm.allowed) {
      return {
        status: perm.status || 'PERMISSION_REQUIRED',
        naturalResponse: `Chinna, I need call permissions on your Android device to place this phone call. (${perm.reason})`,
      };
    }

    // 2. Resolve Contact locally
    const resolution = contactResolver.resolveContact(contactQuery);

    if (resolution.status === 'NOT_FOUND') {
      return {
        status: 'CONTACT_NOT_FOUND',
        naturalResponse: `I couldn't find "${contactQuery}" in your contacts, Chinna.`,
      };
    }

    if (resolution.status === 'AMBIGUOUS') {
      return {
        status: 'AMBIGUOUS_CONTACT',
        naturalResponse: resolution.disambiguationPrompt || `I found multiple contacts for ${contactQuery}. Which one do you mean, Chinna?`,
      };
    }

    const contact = resolution.contact!;

    // 3. Safety Evaluation
    const safety = callSafetyManager.evaluateOutgoingCall(contact);
    if (!safety.allowed) {
      return {
        status: safety.status || 'CALL_FAILED',
        naturalResponse: `I can't place this call right now: ${safety.reason}`,
      };
    }

    // 4. Confirmation policy
    if (this.confirmOutgoingCalls) {
      callStateManager.setPendingConfirmationContact(contact);
      callStateManager.transition('OUTGOING_CONFIRMATION', {
        type: 'outgoing',
        phoneNumber: contact.phoneNumber,
        callerName: contact.name,
        resolvedContact: contact,
      });

      const displayTarget = contact.relationship === 'Mother' ? 'Mom' : contact.relationship === 'Father' ? 'Dad' : contact.name;
      return {
        status: 'CALL_STARTED',
        naturalResponse: `Call ${displayTarget}?`,
        contact,
        requiresConfirmation: true,
      };
    }

    // 5. Direct Execution (if confirmation disabled)
    return this.executeDial(contact);
  }

  /**
   * Step 2: Confirm and dial the pending outgoing call
   */
  public async confirmPendingCall(): Promise<OutgoingCallResult> {
    const pendingContact = callStateManager.getPendingConfirmationContact();
    if (!pendingContact) {
      return {
        status: 'CALL_FAILED',
        naturalResponse: `There is no pending call to place, Chinna.`,
      };
    }

    return this.executeDial(pendingContact);
  }

  /**
   * Cancel any pending outgoing call
   */
  public cancelPendingCall(): OutgoingCallResult {
    const pending = callStateManager.getPendingConfirmationContact();
    callStateManager.setPendingConfirmationContact(null);
    callStateManager.transition('CANCELLED');
    setTimeout(() => {
      if (callStateManager.getState() === 'CANCELLED') {
        callStateManager.transition('IDLE');
      }
    }, 1200);

    return {
      status: 'CANCELLED',
      naturalResponse: `Okay, I cancelled the call, Chinna.`,
      contact: pending || undefined,
    };
  }

  /**
   * Execute actual dial action via native Android Telecom / Phone Bridge / tel: URI
   */
  private async executeDial(contact: ContactRecord): Promise<OutgoingCallResult> {
    callStateManager.transition('OUTGOING_DIALING', {
      type: 'outgoing',
      phoneNumber: contact.phoneNumber,
      callerName: contact.name,
      resolvedContact: contact,
      timestamp: Date.now(),
    });

    const displayTarget = contact.relationship === 'Mother' ? 'Mom' : contact.relationship === 'Father' ? 'Dad' : contact.name;
    const cleanNum = contact.phoneNumber.replace(/[^0-9+]/g, '');

    const win = typeof window !== 'undefined' ? (window as any) : {};

    // A. Native Android Telecom / Phone Bridge
    if (win.AndroidTelecomBridge?.placeCall) {
      try {
        win.AndroidTelecomBridge.placeCall(cleanNum);
        callStateManager.transition('IN_CALL');
        return {
          status: 'CALL_STARTED',
          naturalResponse: `Okay, calling ${displayTarget} now.`,
          contact,
        };
      } catch (err) {
        console.error('[OutgoingCallManager] AndroidTelecomBridge failed:', err);
      }
    }

    if (win.AndroidPhoneBridge?.dialNumber) {
      try {
        win.AndroidPhoneBridge.dialNumber(cleanNum);
        callStateManager.transition('IN_CALL');
        return {
          status: 'CALL_STARTED',
          naturalResponse: `Okay, calling ${displayTarget} now.`,
          contact,
        };
      } catch (err) {
        console.error('[OutgoingCallManager] AndroidPhoneBridge failed:', err);
      }
    }

    // B. Android Intent / System tel: URI
    try {
      // In web preview or Android WebView fallback:
      const telLink = document.createElement('a');
      telLink.href = `tel:${cleanNum}`;
      telLink.style.display = 'none';
      document.body.appendChild(telLink);
      telLink.click();
      document.body.removeChild(telLink);

      callStateManager.transition('IN_CALL');
      return {
        status: 'CALL_STARTED',
        naturalResponse: `Okay, calling ${displayTarget} now.`,
        contact,
      };
    } catch (err) {
      callStateManager.transition('ERROR');
      return {
        status: 'CALL_FAILED',
        naturalResponse: `I couldn't trigger the phone dialer, Chinna. Please check phone permissions.`,
        contact,
      };
    }
  }
}

export const outgoingCallManager = OutgoingCallManager.getInstance();
