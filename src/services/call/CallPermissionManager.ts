import { CallExecutionStatus } from '../../types';

export class CallPermissionManager {
  private static instance: CallPermissionManager | null = null;

  private constructor() {}

  public static getInstance(): CallPermissionManager {
    if (!CallPermissionManager.instance) {
      CallPermissionManager.instance = new CallPermissionManager();
    }
    return CallPermissionManager.instance;
  }

  /**
   * Evaluates native Android telecom and telephony capability.
   */
  public getTelecomCapability(): 'FULL_NATIVE' | 'TELECOM_IN_CALL_SERVICE' | 'INTENT_DIALER_ONLY' | 'BROWSER_RESTRICTED' | 'UNAVAILABLE' {
    if (typeof window === 'undefined') {
      return 'UNAVAILABLE';
    }

    const win = window as any;

    // 1. Check for complete native InCallService Telecom bridge
    if (win.AndroidTelecomBridge?.answerCall && win.AndroidTelecomBridge?.rejectCall) {
      return 'FULL_NATIVE';
    }

    // 2. Check for standard Android Phone Bridge
    if (win.AndroidPhoneBridge?.dialNumber || win.AndroidTelecomBridge) {
      return 'TELECOM_IN_CALL_SERVICE';
    }

    // 3. Check for Android intent / URI capability
    if (win.AndroidBridge || navigator.userAgent.includes('Android')) {
      return 'INTENT_DIALER_ONLY';
    }

    // 4. Browser environment
    return 'BROWSER_RESTRICTED';
  }

  /**
   * Check permission states
   */
  public getPermissionState(): {
    readContacts: boolean;
    callPhone: boolean;
    telecomInCall: boolean;
  } {
    const win = typeof window !== 'undefined' ? (window as any) : {};
    const isAndroidNative = !!(win.AndroidTelecomBridge || win.AndroidPhoneBridge || win.AndroidContactBridge);

    return {
      readContacts: isAndroidNative ? (win.AndroidContactBridge?.hasPermission?.() ?? true) : true,
      callPhone: isAndroidNative ? (win.AndroidPhoneBridge?.hasCallPermission?.() ?? true) : true,
      telecomInCall: isAndroidNative ? (win.AndroidTelecomBridge?.isInCallServiceActive?.() ?? false) : false,
    };
  }

  /**
   * Check if outgoing calls can be executed natively or via system intent
   */
  public canMakeOutgoingCalls(): { allowed: boolean; status?: CallExecutionStatus; reason?: string } {
    const capability = this.getTelecomCapability();
    const permissions = this.getPermissionState();

    if (capability === 'UNAVAILABLE') {
      return {
        allowed: false,
        status: 'PLATFORM_RESTRICTION',
        reason: 'Telephony subsystem is unavailable in this environment.',
      };
    }

    if (!permissions.callPhone) {
      return {
        allowed: false,
        status: 'NATIVE_PERMISSION_REQUIRED',
        reason: 'CALL_PHONE permission is required in Android settings.',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if answering/rejecting incoming calls is supported
   */
  public canControlIncomingCalls(): { allowed: boolean; status?: CallExecutionStatus; reason?: string } {
    const capability = this.getTelecomCapability();
    const win = typeof window !== 'undefined' ? (window as any) : {};

    if (capability === 'FULL_NATIVE') {
      return { allowed: true };
    }

    if (capability === 'TELECOM_IN_CALL_SERVICE') {
      const hasDefaultDialer = win.AndroidTelecomBridge?.isDefaultDialer?.() ?? false;
      if (!hasDefaultDialer) {
        return {
          allowed: false,
          status: 'DEFAULT_DIALER_ROLE_REQUIRED',
          reason: 'Android 10+ requires default dialer role or InCallService to control incoming calls directly.',
        };
      }
      return { allowed: true };
    }

    return {
      allowed: false,
      status: 'PLATFORM_RESTRICTION',
      reason: 'Incoming call answer/reject requires Android native Telecom InCallService integration.',
    };
  }
}

export const callPermissionManager = CallPermissionManager.getInstance();
