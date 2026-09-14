import { Capacitor, registerPlugin } from '@capacitor/core';

// =========================================================
// TORCH TYPES
// =========================================================

export interface TorchResult {
  success: boolean;
  enabled: boolean;
}

export interface TorchStatus {
  available: boolean;
  enabled: boolean;
}

// =========================================================
// VOLUME TYPES
// =========================================================

export interface VolumeResult {
  success: boolean;
  volume: number;
  current?: number;
  max?: number;
  error?: string;
}

// =========================================================
// BRIGHTNESS TYPES
// =========================================================

export interface BrightnessResult {
  success: boolean;
  brightness?: number;
  permissionRequired?: boolean;
  error?: string;
}

export interface SystemSettingsPermissionResult {
  allowed: boolean;
}

export interface OpenSettingsResult {
  success: boolean;
  error?: string;
}

// =========================================================
// NATIVE PLUGIN INTERFACE
// =========================================================

interface MyraaDevicePlugin {

  // ---------------- TORCH ----------------

  turnTorchOn(): Promise<TorchResult>;

  turnTorchOff(): Promise<TorchResult>;

  toggleTorch(): Promise<TorchResult>;

  getTorchStatus(): Promise<TorchStatus>;


  // ---------------- VOLUME ----------------

  getVolume(): Promise<VolumeResult>;

  setVolume(options: {
    volume: number;
  }): Promise<VolumeResult>;

  increaseVolume(options?: {
    step?: number;
  }): Promise<VolumeResult>;

  decreaseVolume(options?: {
    step?: number;
  }): Promise<VolumeResult>;


  // ---------------- SYSTEM BRIGHTNESS ----------------

  canWriteSystemSettings():
    Promise<SystemSettingsPermissionResult>;

  openWriteSettingsPermission():
    Promise<OpenSettingsResult>;

  getSystemBrightness():
    Promise<BrightnessResult>;

  setSystemBrightness(options: {
    brightness: number;
  }): Promise<BrightnessResult>;
}

// =========================================================
// REGISTER NATIVE PLUGIN
// =========================================================

const NativeMyraaDevice =
  registerPlugin<MyraaDevicePlugin>(
    'MyraaDevice'
  );

// =========================================================
// MYRAA DEVICE SERVICE
// =========================================================

export class MyraaDevice {

  // =======================================================
  // PLATFORM CHECK
  // =======================================================

  public static isNativeAndroid(): boolean {

    return (
      Capacitor.isNativePlatform()
      &&
      Capacitor.getPlatform() === 'android'
    );
  }


  // =======================================================
  // TORCH
  // =======================================================

  public static async turnTorchOn():
    Promise<TorchResult> {

    if (!this.isNativeAndroid()) {

      return {
        success: false,
        enabled: false
      };
    }

    try {

      return await
        NativeMyraaDevice.turnTorchOn();

    } catch (error) {

      console.error(
        '[MyraaDevice] Native torch ON failed:',
        error
      );

      return {
        success: false,
        enabled: false
      };
    }
  }


  public static async turnTorchOff():
    Promise<TorchResult> {

    if (!this.isNativeAndroid()) {

      return {
        success: false,
        enabled: false
      };
    }

    try {

      return await
        NativeMyraaDevice.turnTorchOff();

    } catch (error) {

      console.error(
        '[MyraaDevice] Native torch OFF failed:',
        error
      );

      return {
        success: false,
        enabled: false
      };
    }
  }


  public static async toggleTorch():
    Promise<TorchResult> {

    if (!this.isNativeAndroid()) {

      return {
        success: false,
        enabled: false
      };
    }

    try {

      return await
        NativeMyraaDevice.toggleTorch();

    } catch (error) {

      console.error(
        '[MyraaDevice] Native torch toggle failed:',
        error
      );

      return {
        success: false,
        enabled: false
      };
    }
  }


  public static async getTorchStatus():
    Promise<TorchStatus> {

    if (!this.isNativeAndroid()) {

      return {
        available: false,
        enabled: false
      };
    }

    try {

      return await
        NativeMyraaDevice.getTorchStatus();

    } catch (error) {

      console.error(
        '[MyraaDevice] Native torch status failed:',
        error
      );

      return {
        available: false,
        enabled: false
      };
    }
  }


  // =======================================================
  // REAL ANDROID VOLUME
  // =======================================================

  public static async getVolume():
    Promise<VolumeResult> {

    if (!this.isNativeAndroid()) {

      return {
        success: false,
        volume: 0,
        error: 'NOT_NATIVE_ANDROID'
      };
    }

    try {

      return await
        NativeMyraaDevice.getVolume();

    } catch (error) {

      console.error(
        '[MyraaDevice] Native get volume failed:',
        error
      );

      return {
        success: false,
        volume: 0,
        error: String(error)
      };
    }
  }


  public static async setVolume(
    volume: number
  ): Promise<VolumeResult> {

    if (!this.isNativeAndroid()) {

      return {
        success: false,
        volume: 0,
        error: 'NOT_NATIVE_ANDROID'
      };
    }

    volume = Math.max(
      0,
      Math.min(100, volume)
    );

    try {

      return await
        NativeMyraaDevice.setVolume({
          volume
        });

    } catch (error) {

      console.error(
        '[MyraaDevice] Native set volume failed:',
        error
      );

      return {
        success: false,
        volume,
        error: String(error)
      };
    }
  }


  public static async increaseVolume(
    step: number = 10
  ): Promise<VolumeResult> {

    if (!this.isNativeAndroid()) {

      return {
        success: false,
        volume: 0,
        error: 'NOT_NATIVE_ANDROID'
      };
    }

    try {

      return await
        NativeMyraaDevice.increaseVolume({
          step
        });

    } catch (error) {

      console.error(
        '[MyraaDevice] Native increase volume failed:',
        error
      );

      return {
        success: false,
        volume: 0,
        error: String(error)
      };
    }
  }


  public static async decreaseVolume(
    step: number = 10
  ): Promise<VolumeResult> {

    if (!this.isNativeAndroid()) {

      return {
        success: false,
        volume: 0,
        error: 'NOT_NATIVE_ANDROID'
      };
    }

    try {

      return await
        NativeMyraaDevice.decreaseVolume({
          step
        });

    } catch (error) {

      console.error(
        '[MyraaDevice] Native decrease volume failed:',
        error
      );

      return {
        success: false,
        volume: 0,
        error: String(error)
      };
    }
  }


  // =======================================================
  // SYSTEM BRIGHTNESS
  // =======================================================

  public static async canWriteSystemSettings():
    Promise<SystemSettingsPermissionResult> {

    if (!this.isNativeAndroid()) {

      return {
        allowed: false
      };
    }

    try {

      return await
        NativeMyraaDevice
          .canWriteSystemSettings();

    } catch (error) {

      console.error(
        '[MyraaDevice] System settings permission check failed:',
        error
      );

      return {
        allowed: false
      };
    }
  }


  public static async openWriteSettingsPermission():
    Promise<OpenSettingsResult> {

    if (!this.isNativeAndroid()) {

      return {
        success: false,
        error: 'NOT_NATIVE_ANDROID'
      };
    }

    try {

      return await
        NativeMyraaDevice
          .openWriteSettingsPermission();

    } catch (error) {

      console.error(
        '[MyraaDevice] Open system settings failed:',
        error
      );

      return {
        success: false,
        error: String(error)
      };
    }
  }


  public static async getSystemBrightness():
    Promise<BrightnessResult> {

    if (!this.isNativeAndroid()) {

      return {
        success: false,
        error: 'NOT_NATIVE_ANDROID'
      };
    }

    try {

      return await
        NativeMyraaDevice
          .getSystemBrightness();

    } catch (error) {

      console.error(
        '[MyraaDevice] Get brightness failed:',
        error
      );

      return {
        success: false,
        error: String(error)
      };
    }
  }


  public static async setSystemBrightness(
    brightness: number
  ): Promise<BrightnessResult> {

    if (!this.isNativeAndroid()) {

      return {
        success: false,
        error: 'NOT_NATIVE_ANDROID'
      };
    }

    brightness = Math.max(
      1,
      Math.min(100, brightness)
    );

    try {

      return await
        NativeMyraaDevice
          .setSystemBrightness({
            brightness
          });

    } catch (error) {

      console.error(
        '[MyraaDevice] Set brightness failed:',
        error
      );

      return {
        success: false,
        error: String(error)
      };
    }
  }
}
