import {
  CallState,
  CallInfo,
  CallDiagnostics,
  CallManagerSettings,
  ContactRecord,
  DebugLog,
} from '../../types';
import { outgoingCallManager, OutgoingCallManager, OutgoingCallResult } from './OutgoingCallManager';
import { incomingCallManager, IncomingCallManager, IncomingCallActionResult } from './IncomingCallManager';
import { contactManager, ContactManager } from './ContactManager';
import { contactResolver, ContactResolver } from './ContactResolver';
import { callerIdentificationManager, CallerIdentificationManager } from './CallerIdentificationManager';
import { callPermissionManager, CallPermissionManager } from './CallPermissionManager';
import { callSafetyManager, CallSafetyManager } from './CallSafetyManager';
import { callStateManager, CallStateManager } from './CallStateManager';

export type CallLogCallback = (log: Omit<DebugLog, 'id' | 'timestamp'>) => void;

export class CallManager {
  private static instance: CallManager | null = null;
  private logCallback: CallLogCallback | null = null;

  // Sub-components
  public readonly outgoing: OutgoingCallManager = outgoingCallManager;
  public readonly incoming: IncomingCallManager = incomingCallManager;
  public readonly contacts: ContactManager = contactManager;
  public readonly resolver: ContactResolver = contactResolver;
  public readonly callerId: CallerIdentificationManager = callerIdentificationManager;
  public readonly permissions: CallPermissionManager = callPermissionManager;
  public readonly safety: CallSafetyManager = callSafetyManager;
  public readonly state: CallStateManager = callStateManager;

  private settings: CallManagerSettings = {
    confirmOutgoingCalls: true,
    askBeforeAnswering: true,
    autoMuteAssistantDuringCalls: true,
  };

  private lastAction = 'NONE';
  private lastResultStatus: any = undefined;
  private lastLatencyMs = 0;

  private constructor() {
    this.outgoing.setConfirmOutgoingCalls(this.settings.confirmOutgoingCalls);
    this.incoming.setAskBeforeAnswering(this.settings.askBeforeAnswering);
  }

  public static getInstance(): CallManager {
    if (!CallManager.instance) {
      CallManager.instance = new CallManager();
    }
    return CallManager.instance;
  }

  public setLogCallback(callback: CallLogCallback): void {
    this.logCallback = callback;
  }

  private log(level: 'info' | 'warn' | 'error' | 'success', source: 'CALL' | 'TELECOM' | 'CONTACTS', message: string): void {
    const sanitized = this.safety.sanitizeLog(message);
    if (this.logCallback) {
      this.logCallback({ level, source, message: sanitized });
    }
  }

  // ==========================================
  // OUTGOING CALL OPERATIONS
  // ==========================================

  public async callContact(contactName: string): Promise<OutgoingCallResult> {
    const t0 = performance.now();
    this.lastAction = `call_contact: ${contactName}`;
    this.log('info', 'CALL', `Initiating outgoing call request for "${contactName}"`);

    const result = await this.outgoing.requestCall(contactName);
    this.lastLatencyMs = Math.round(performance.now() - t0);
    this.lastResultStatus = result.status;

    this.log(
      result.status === 'CALL_STARTED' ? 'success' : result.status === 'CANCELLED' ? 'warn' : 'info',
      'CALL',
      `Outgoing call status [${result.status}] in ${this.lastLatencyMs}ms: "${result.naturalResponse}"`
    );

    return result;
  }

  public async confirmPendingCall(): Promise<OutgoingCallResult> {
    const t0 = performance.now();
    this.lastAction = 'confirm_pending_call';
    const result = await this.outgoing.confirmPendingCall();
    this.lastLatencyMs = Math.round(performance.now() - t0);
    this.lastResultStatus = result.status;
    this.log('success', 'CALL', `Confirmed pending call: ${result.naturalResponse}`);
    return result;
  }

  public cancelPendingCall(): OutgoingCallResult {
    const t0 = performance.now();
    this.lastAction = 'cancel_pending_call';
    const result = this.outgoing.cancelPendingCall();
    this.lastLatencyMs = Math.round(performance.now() - t0);
    this.lastResultStatus = result.status;
    this.log('info', 'CALL', `Cancelled pending call.`);
    return result;
  }

  // ==========================================
  // INCOMING CALL OPERATIONS
  // ==========================================

  public async answerIncomingCall(): Promise<IncomingCallActionResult> {
    const t0 = performance.now();
    this.lastAction = 'answer_incoming_call';
    this.log('info', 'TELECOM', `User requested to answer incoming call.`);

    const result = await this.incoming.answerCall();
    this.lastLatencyMs = Math.round(performance.now() - t0);
    this.lastResultStatus = result.status;

    this.log('success', 'TELECOM', `Incoming call answer status: [${result.status}]`);
    return result;
  }

  public async rejectIncomingCall(): Promise<IncomingCallActionResult> {
    const t0 = performance.now();
    this.lastAction = 'reject_incoming_call';
    this.log('info', 'TELECOM', `User requested to reject/decline incoming call.`);

    const result = await this.incoming.rejectCall();
    this.lastLatencyMs = Math.round(performance.now() - t0);
    this.lastResultStatus = result.status;

    this.log('info', 'TELECOM', `Incoming call rejection status: [${result.status}]`);
    return result;
  }

  public getCallState(): { state: CallState; activeCall: CallInfo | null } {
    return {
      state: this.state.getState(),
      activeCall: this.state.getActiveCall(),
    };
  }

  public getIncomingCaller(): { callerName?: string; maskedNumber: string; isKnown: boolean } | null {
    const active = this.state.getActiveCall();
    if (!active) return null;
    return {
      callerName: active.callerName,
      maskedNumber: this.callerId.maskPhoneNumber(active.phoneNumber),
      isKnown: !!active.resolvedContact,
    };
  }

  public getRecentCallStatus(): { recentCalls: CallInfo[]; summary: string } {
    const recent = this.state.getRecentCalls();
    if (recent.length === 0) {
      return {
        recentCalls: [],
        summary: "You don't have any recent calls, Chinna.",
      };
    }
    const last = recent[0];
    const name = last.callerName || (last.resolvedContact ? last.resolvedContact.name : 'an unknown number');
    const action = last.type === 'incoming' ? (last.missed ? 'missed a call from' : 'received a call from') : 'called';
    return {
      recentCalls: recent,
      summary: `You recently ${action} ${name}.`,
    };
  }

  // ==========================================
  // SETTINGS & DIAGNOSTICS
  // ==========================================

  public getSettings(): CallManagerSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<CallManagerSettings>): void {
    this.settings = { ...this.settings, ...partial };
    if (partial.confirmOutgoingCalls !== undefined) {
      this.outgoing.setConfirmOutgoingCalls(partial.confirmOutgoingCalls);
    }
    if (partial.askBeforeAnswering !== undefined) {
      this.incoming.setAskBeforeAnswering(partial.askBeforeAnswering);
    }
    this.log('info', 'CALL', `Call settings updated.`);
  }

  public getDiagnostics(): CallDiagnostics {
    const active = this.state.getActiveCall();
    return {
      callState: this.state.getState(),
      permissionState: this.permissions.getPermissionState(),
      telecomCapability: this.permissions.getTelecomCapability(),
      lastCaller: active
        ? {
            name: active.callerName,
            maskedNumber: this.callerId.maskPhoneNumber(active.phoneNumber),
            isUnknown: !active.resolvedContact,
          }
        : undefined,
      lastRequestedAction: this.lastAction,
      lastExecutionResult: this.lastResultStatus,
      lastExecutionLatencyMs: this.lastLatencyMs,
      isAssistantAudioSuppressed: this.state.isAudioSuppressed(),
    };
  }

  // Developer Test helper
  public simulateIncomingCallForTesting(phoneNumber: string): void {
    this.log('info', 'TELECOM', `Triggering test incoming call from ${this.callerId.maskPhoneNumber(phoneNumber)}`);
    this.incoming.handleIncomingCallRinging(phoneNumber);
  }
}

export const callManager = CallManager.getInstance();
