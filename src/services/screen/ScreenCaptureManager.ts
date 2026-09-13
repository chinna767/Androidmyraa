import { ScreenFrameData } from '../../types';
import { screenPermissionManager } from './ScreenPermissionManager';
import { screenFrameProcessor } from './ScreenFrameProcessor';

export class ScreenCaptureManager {
  private static instance: ScreenCaptureManager | null = null;
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private isCapturing = false;
  private onStateChangeCallback: ((isCapturing: boolean) => void) | null = null;

  private constructor() {
    if (typeof document !== 'undefined') {
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.style.display = 'none';
      document.body.appendChild(this.videoElement);
    }
  }

  public static getInstance(): ScreenCaptureManager {
    if (!ScreenCaptureManager.instance) {
      ScreenCaptureManager.instance = new ScreenCaptureManager();
    }
    return ScreenCaptureManager.instance;
  }

  public setOnStateChangeCallback(cb: (isCapturing: boolean) => void): void {
    this.onStateChangeCallback = cb;
  }

  /**
   * Request explicit screen capture permission from the user.
   */
  public async requestScreenCapture(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check native Android MediaProjection bridge if available
      if ((window as any).AndroidMediaProjection?.startCapture) {
        (window as any).AndroidMediaProjection.startCapture();
        screenPermissionManager.setStatus('granted');
        this.isCapturing = true;
        this.onStateChangeCallback?.(true);
        return { success: true };
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        screenPermissionManager.setStatus('unavailable');
        return { success: false, error: 'Screen capture API is not available on this platform.' };
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: 5, max: 15 }, // Keep frame rate low to save battery and memory
        } as any,
        audio: false,
      });

      this.mediaStream = stream;
      if (this.videoElement) {
        this.videoElement.srcObject = stream;
        await this.videoElement.play().catch(() => {});
      }

      // Handle user stopping screen share via browser/OS UI
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopScreenCapture();
        };
      }

      this.isCapturing = true;
      screenPermissionManager.setStatus('granted');
      this.onStateChangeCallback?.(true);

      return { success: true };
    } catch (err: any) {
      console.warn('[ScreenCaptureManager] Screen capture request failed/denied:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        screenPermissionManager.setStatus('denied');
        return { success: false, error: 'Screen capture permission was denied by the user.' };
      }
      screenPermissionManager.setStatus('unavailable');
      return { success: false, error: err.message || 'Failed to start screen capture.' };
    }
  }

  /**
   * Captures a single current frame on-demand.
   */
  public async captureCurrentFrame(): Promise<ScreenFrameData | null> {
    // If not capturing yet, attempt to request permission explicitly
    if (!this.isCapturing || !this.mediaStream) {
      const startRes = await this.requestScreenCapture();
      if (!startRes.success) {
        return null;
      }
    }

    if (!this.videoElement || this.videoElement.videoWidth === 0) {
      // Wait briefly for video dimensions to settle
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (!this.videoElement || this.videoElement.videoWidth === 0) {
      return null;
    }

    return screenFrameProcessor.processVideoFrame(this.videoElement);
  }

  /**
   * Stops screen capture and cleans up all hardware resources.
   */
  public stopScreenCapture(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.isCapturing = false;
    this.onStateChangeCallback?.(false);
  }

  public isStreamingActive(): boolean {
    return this.isCapturing && !!this.mediaStream && this.mediaStream.active;
  }
}

export const screenCaptureManager = ScreenCaptureManager.getInstance();
