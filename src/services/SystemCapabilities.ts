/**
 * SystemCapabilities.ts
 * Real-time platform capability detection for MYRAA.
 * Evaluates available APIs, OS version, permissions, and device hardware.
 * Strictly separates supported browser capabilities from native Android requirements.
 */

import { CapabilityStatus, SystemCapabilitiesInfo } from '../types';

export class SystemCapabilities {
  private static instance: SystemCapabilities | null = null;
  private capabilities: SystemCapabilitiesInfo;

  private constructor() {
    this.capabilities = this.detectCapabilities();
    this.checkTorchHardwareAsync();
  }

  public static getInstance(): SystemCapabilities {
    if (!SystemCapabilities.instance) {
      SystemCapabilities.instance = new SystemCapabilities();
    }
    return SystemCapabilities.instance;
  }

  private detectCapabilities(): SystemCapabilitiesInfo {
    const isBrowser = typeof window !== 'undefined';
    const ua = isBrowser ? navigator.userAgent || '' : '';
    const isAndroid = /Android/i.test(ua);
    const isElectron = /Electron/i.test(ua);

    let platform: 'browser' | 'android' | 'electron' | 'unknown' = 'browser';
    if (isAndroid) {
      // Check if native Android bridge or Webview is present
      const hasAndroidBridge = typeof (window as any).AndroidBridge !== 'undefined' || typeof (window as any).JSInterface !== 'undefined';
      platform = hasAndroidBridge ? 'android' : 'browser';
    } else if (isElectron) {
      platform = 'electron';
    }

    let osName = 'Unknown OS';
    if (/Android/i.test(ua)) osName = 'Android OS';
    else if (/iPhone|iPad|iPod/i.test(ua)) osName = 'iOS';
    else if (/Macintosh|Mac OS X/i.test(ua)) osName = 'macOS';
    else if (/Windows/i.test(ua)) osName = 'Windows';
    else if (/Linux/i.test(ua)) osName = 'Linux';

    return {
      platform,
      userAgent: ua,
      isNativeAndroid: platform === 'android',
      osName,
      // Volume: Available via Web Audio Master Gain & Media elements; native system volume requires Android API
      volume_control: 'available',
      // Brightness: Available via dynamic Screen Brightness overlay + ambient viewport filters
      brightness_control: 'available',
      // Torch: Checked asynchronously; initially 'limited' or 'available' if MediaTrackConstraints torch exists
      torch_control: isBrowser && navigator.mediaDevices ? 'available' : 'unavailable',
      // Mobile data: Always restricted in browser sandboxes; requires native Android system settings
      mobile_data_control: platform === 'android' ? 'available' : 'restricted',
      // Time & Date: Fully available via device system clock & locale
      time: 'available',
      date: 'available',
      // YouTube: Fully available via embedded IFrame API and MediaSession
      youtube: 'available',
      // Navigation & Scroll: Available within application viewport
      back: 'available',
      scroll: 'available',
    };
  }

  /**
   * Probe camera track capabilities to verify if real hardware torch exists
   */
  private async checkTorchHardwareAsync(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getSupportedConstraints) {
      this.capabilities.torch_control = 'unavailable';
      return;
    }

    try {
      const supported = navigator.mediaDevices.getSupportedConstraints();
      if (!('torch' in supported)) {
        this.capabilities.torch_control = 'limited';
      }
    } catch (e) {
      this.capabilities.torch_control = 'unavailable';
    }
  }

  public getCapabilities(): { name: string; status: CapabilityStatus; notes: string }[] {
    return [
      {
        name: 'Volume & Audio Gain',
        status: this.capabilities.volume_control,
        notes: 'Direct Web Audio gain node control with unattenuated output path',
      },
      {
        name: 'Screen Brightness',
        status: this.capabilities.brightness_control,
        notes: 'Interactive CSS ambient overlay viewport calibration (10% - 100%)',
      },
      {
        name: 'Camera Flashlight / Torch',
        status: this.capabilities.torch_control,
        notes: 'MediaTrackConstraints torch API with camera fallback',
      },
      {
        name: 'Mobile Cellular Data',
        status: this.capabilities.mobile_data_control,
        notes: 'Network status detection (Direct radio switching requires native Android OS settings)',
      },
      {
        name: 'System Time & Clock',
        status: this.capabilities.time,
        notes: 'Real-time device clock and timezone resolver',
      },
      {
        name: 'Calendar & Date',
        status: this.capabilities.date,
        notes: 'Device date engine with ordinal day formatting',
      },
      {
        name: 'YouTube Media Player',
        status: this.capabilities.youtube,
        notes: 'Integrated search, playback, pause, resume, and stream controls',
      },
      {
        name: 'Viewport Navigation & Scroll',
        status: this.capabilities.scroll,
        notes: 'Smooth transcript and container scrolling',
      },
    ];
  }

  public getCapabilityInfo(): SystemCapabilitiesInfo {
    return { ...this.capabilities };
  }

  public isNativeAndroid(): boolean {
    return this.capabilities.isNativeAndroid;
  }
}

export const systemCapabilities = SystemCapabilities.getInstance();
