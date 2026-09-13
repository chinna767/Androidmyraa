import { CallExecutionStatus } from '../../types';
import { callerIdentificationManager, CallerIdentificationResult } from './CallerIdentificationManager';
import { callPermissionManager } from './CallPermissionManager';
import { callStateManager } from './CallStateManager';

export interface IncomingCallActionResult {
  status: CallExecutionStatus;
  naturalResponse: string;
  callerInfo?: CallerIdentificationResult;
}

export type IncomingCallNotificationCallback = (announcement: string, identification: CallerIdentificationResult) => void;

export class IncomingCallManager {
  private static instance: IncomingCallManager | null = null;
  private askBeforeAnswering = true;
  private notificationCallback: IncomingCallNotificationCallback | null = null;
  private activeCallerInfo: CallerIdentificationResult | null = null;

  private constructor() {
    this.registerNativeListeners();
  }

  public static getInstance(): IncomingCallManager {
    if (!IncomingCallManager.instance) {
      IncomingCallManager.instance = new IncomingCallManager();
    }
    return IncomingCallManager.instance;
  }

  public setAskBeforeAnswering(enabled: boolean): void {
    this.askBeforeAnswering = enabled;
  }

  public getAskBeforeAnswering(): boolean {
    return this.askBeforeAnswering;
  }

  public setNotificationCallback(cb: IncomingCallNotificationCallback): void {
    this.notificationCallback = cb;
  }

  public getActiveCallerInfo(): CallerIdentificationResult | null {
    return this.activeCallerInfo;
  }

  /**
   * Register listeners on native Android bridge if running in native Android container.
   */
  private registerNativeListeners(): void {
    if (typeof window === 'undefined') return;
    const win = window as any;

    // Bridge callback for incoming call event from InCallService
    win.onMyraaNativeIncomingCall = (rawPhoneNumber: string) => {
      this.handleIncomingCallRinging(rawPhoneNumber);
    };

    win.onMyraaNativeCallEnded = () => {
      this.handleCallDisconnected();
    };
  }

  /**
   * Handles an incoming ringing call event from Android Telecom InCallService
   */
  public handleIncomingCallRinging(phoneNumber: string): CallerIdentificationResult {
    // 1. Identify caller
    const identification = callerIdentificationManager.identifyCaller(phoneNumber, this.askBeforeAnswering);
    this.activeCallerInfo = identification;

    // 2. Transition state machine
    callStateManager.transition('INCOMING_RINGING', {
      type: 'incoming',
      phoneNumber,
      callerName: identification.callerName,
      resolvedContact: identification.contact,
      timestamp: Date.now(),
    });

    callStateManager.transition('INCOMING_IDENTIFYING');
    callStateManager.transition('WAITING_FOR_USER_DECISION');

    // 3. Notify voice callback for MYRAA speech announcement
    if (this.notificationCallback) {
      this.notificationCallback(identification.formattedAnnouncement, identification);
    }

    return identification;
  }

  /**
   * User answers the call ("Pick up", "Answer", "Accept", "Take the call", "Yes")
   */
  public async answerCall(): Promise<IncomingCallActionResult> {
    const activeCall = callStateManager.getActiveCall();
    if (!activeCall || callStateManager.getState() !== 'WAITING_FOR_USER_DECISION') {
      return {
        status: 'CALL_FAILED',
        naturalResponse: `There is no incoming call to pick up, Chinna.`,
      };
    }

    // Permission check
    const perm = callPermissionManager.canControlIncomingCalls();
    const win = typeof window !== 'undefined' ? (window as any) : {};

    if (win.AndroidTelecomBridge?.answerCall) {
      try {
        win.AndroidTelecomBridge.answerCall();
        callStateManager.transition('ANSWERING');
        callStateManager.transition('IN_CALL');
        return {
          status: 'CALL_ANSWERED',
          naturalResponse: `Okay.`,
          callerInfo: this.activeCallerInfo || undefined,
        };
      } catch (err) {
        console.error('[IncomingCallManager] Failed to answer call via bridge:', err);
      }
    }

    // In web preview or browser environment without native InCallService:
    if (!perm.allowed) {
      callStateManager.transition('IN_CALL');
      return {
        status: perm.status || 'DEFAULT_DIALER_ROLE_REQUIRED',
        naturalResponse: `Okay. Answering the call. (${perm.reason})`,
        callerInfo: this.activeCallerInfo || undefined,
      };
    }

    callStateManager.transition('ANSWERING');
    callStateManager.transition('IN_CALL');
    return {
      status: 'CALL_ANSWERED',
      naturalResponse: `Okay.`,
      callerInfo: this.activeCallerInfo || undefined,
    };
  }

  /**
   * User rejects/declines the call ("Don't pick up", "Reject", "Decline", "Ignore it", "No")
   */
  public async rejectCall(): Promise<IncomingCallActionResult> {
    const activeCall = callStateManager.getActiveCall();
    if (!activeCall || callStateManager.getState() !== 'WAITING_FOR_USER_DECISION') {
      return {
        status: 'CALL_FAILED',
        naturalResponse: `There is no incoming call to decline, Chinna.`,
      };
    }

    const win = typeof window !== 'undefined' ? (window as any) : {};
    if (win.AndroidTelecomBridge?.rejectCall) {
      try {
        win.AndroidTelecomBridge.rejectCall();
      } catch (err) {
        console.error('[IncomingCallManager] Failed to reject call via bridge:', err);
      }
    }

    callStateManager.transition('REJECTED');
    this.activeCallerInfo = null;

    setTimeout(() => {
      if (callStateManager.getState() === 'REJECTED') {
        callStateManager.transition('IDLE');
      }
    }, 1200);

    return {
      status: 'CALL_REJECTED',
      naturalResponse: `Okay, I'll leave it.`,
    };
  }

  /**
   * Called when active call is disconnected
   */
  public handleCallDisconnected(): void {
    callStateManager.transition('CALL_ENDED');
    this.activeCallerInfo = null;
    setTimeout(() => {
      if (callStateManager.getState() === 'CALL_ENDED') {
        callStateManager.transition('IDLE');
      }
    }, 1200);
  }
}

export const incomingCallManager = IncomingCallManager.getInstance();
