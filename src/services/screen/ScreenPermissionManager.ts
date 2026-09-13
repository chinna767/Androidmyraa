import { ScreenPermissionStatus } from '../../types';

export class ScreenPermissionManager {
  private static instance: ScreenPermissionManager | null = null;
  private currentStatus: ScreenPermissionStatus = 'prompt';

  private constructor() {
    this.checkAvailability();
  }

  public static getInstance(): ScreenPermissionManager {
    if (!ScreenPermissionManager.instance) {
      ScreenPermissionManager.instance = new ScreenPermissionManager();
    }
    return ScreenPermissionManager.instance;
  }

  public checkAvailability(): ScreenPermissionStatus {
    if (typeof window === 'undefined') {
      this.currentStatus = 'unavailable';
      return 'unavailable';
    }

    // Check if Android Native bridge is present
    if ((window as any).AndroidMediaProjection || (window as any).AndroidScreenBridge) {
      this.currentStatus = 'granted';
      return 'granted';
    }

    // Check browser standard mediaDevices API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      this.currentStatus = 'unavailable';
      return 'unavailable';
    }

    return this.currentStatus;
  }

  public getStatus(): ScreenPermissionStatus {
    return this.currentStatus;
  }

  public setStatus(status: ScreenPermissionStatus): void {
    this.currentStatus = status;
  }

  public getPermissionGuidance(): string {
    if (this.currentStatus === 'unavailable') {
      return "Screen capture isn't supported in this environment yet. If you're on Android, make sure the app has screen recording permissions enabled!";
    }
    if (this.currentStatus === 'denied') {
      return "I don't have access to your screen yet. Please click the Screen Awareness toggle in settings to grant screen access so I can see what you're working on.";
    }
    return "I don't have access to your screen yet. You can enable Screen Awareness so I can look at your screen and help you with code and errors!";
  }
}

export const screenPermissionManager = ScreenPermissionManager.getInstance();
