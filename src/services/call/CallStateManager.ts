import { CallState, CallInfo, ContactRecord } from '../../types';

export type CallStateChangeListener = (state: CallState, activeCall: CallInfo | null) => void;

export class CallStateManager {
  private static instance: CallStateManager | null = null;
  private currentState: CallState = 'IDLE';
  private activeCall: CallInfo | null = null;
  private pendingConfirmationContact: ContactRecord | null = null;
  private recentCalls: CallInfo[] = [];
  private listeners: Set<CallStateChangeListener> = new Set();

  private constructor() {}

  public static getInstance(): CallStateManager {
    if (!CallStateManager.instance) {
      CallStateManager.instance = new CallStateManager();
    }
    return CallStateManager.instance;
  }

  public subscribe(listener: CallStateChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState, this.activeCall);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.currentState;
    const call = this.activeCall ? { ...this.activeCall } : null;
    this.listeners.forEach((l) => l(state, call));
  }

  public getState(): CallState {
    return this.currentState;
  }

  public getActiveCall(): CallInfo | null {
    return this.activeCall ? { ...this.activeCall } : null;
  }

  public getPendingConfirmationContact(): ContactRecord | null {
    return this.pendingConfirmationContact;
  }

  public setPendingConfirmationContact(contact: ContactRecord | null): void {
    this.pendingConfirmationContact = contact;
  }

  /**
   * Deterministic transition function for the Call State Machine.
   */
  public transition(newState: CallState, callInfo?: Partial<CallInfo>): boolean {
    const prev = this.currentState;

    // Validate transition validity
    const validTransitions: Record<CallState, CallState[]> = {
      IDLE: ['INCOMING_RINGING', 'OUTGOING_CONFIRMATION', 'OUTGOING_DIALING', 'ERROR'],
      INCOMING_RINGING: ['INCOMING_IDENTIFYING', 'WAITING_FOR_USER_DECISION', 'ANSWERING', 'REJECTED', 'CALL_ENDED', 'ERROR'],
      INCOMING_IDENTIFYING: ['WAITING_FOR_USER_DECISION', 'ANSWERING', 'REJECTED', 'CALL_ENDED', 'ERROR'],
      WAITING_FOR_USER_DECISION: ['ANSWERING', 'REJECTED', 'CALL_ENDED', 'IDLE', 'ERROR'],
      ANSWERING: ['IN_CALL', 'CALL_ENDED', 'ERROR'],
      OUTGOING_CONFIRMATION: ['OUTGOING_DIALING', 'CANCELLED', 'IDLE', 'ERROR'],
      OUTGOING_DIALING: ['IN_CALL', 'CALL_ENDED', 'CANCELLED', 'ERROR', 'IDLE'],
      IN_CALL: ['CALL_ENDED', 'ERROR', 'IDLE'],
      CALL_ENDED: ['IDLE'],
      REJECTED: ['IDLE'],
      CANCELLED: ['IDLE'],
      ERROR: ['IDLE'],
    };

    const allowed = validTransitions[prev]?.includes(newState) ?? true;
    if (!allowed) {
      console.warn(`[CallStateManager] Invalid state transition requested: ${prev} -> ${newState}`);
    }

    this.currentState = newState;

    if (callInfo) {
      if (this.activeCall) {
        this.activeCall = { ...this.activeCall, ...callInfo, state: newState };
      } else {
        this.activeCall = {
          id: callInfo.id || `call-${Date.now()}`,
          type: callInfo.type || 'incoming',
          phoneNumber: callInfo.phoneNumber || '',
          callerName: callInfo.callerName,
          resolvedContact: callInfo.resolvedContact,
          timestamp: callInfo.timestamp || Date.now(),
          state: newState,
          ...callInfo,
        };
      }
    }

    if (newState === 'CALL_ENDED' || newState === 'REJECTED' || newState === 'CANCELLED') {
      if (this.activeCall) {
        this.recentCalls.unshift({ ...this.activeCall, state: newState });
        if (this.recentCalls.length > 20) this.recentCalls.pop();
      }
      this.pendingConfirmationContact = null;
    }

    if (newState === 'IDLE') {
      this.activeCall = null;
      this.pendingConfirmationContact = null;
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Check if assistant audio playback should be suppressed to give phone audio 100% priority.
   */
  public isAudioSuppressed(): boolean {
    return this.currentState === 'IN_CALL' || this.currentState === 'ANSWERING';
  }

  public getRecentCalls(): CallInfo[] {
    return [...this.recentCalls];
  }
}

export const callStateManager = CallStateManager.getInstance();
