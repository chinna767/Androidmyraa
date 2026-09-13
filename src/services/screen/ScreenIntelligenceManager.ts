import {
  ScreenAwarenessState,
  ScreenUnderstandingResult,
  DebugLog,
} from '../../types';
import { screenPermissionManager } from './ScreenPermissionManager';
import { screenCaptureManager } from './ScreenCaptureManager';
import { screenContextManager } from './ScreenContextManager';
import { screenPrivacyManager } from './ScreenPrivacyManager';
import { codeAnalyzer } from './CodeAnalyzer';
import { errorAnalyzer } from './ErrorAnalyzer';
import { geminiVisionAdapter } from './GeminiVisionAdapter';

export type ScreenStateListener = (state: ScreenAwarenessState) => void;
export type ScreenLogCallback = (log: Omit<DebugLog, 'id' | 'timestamp'>) => void;

export class ScreenIntelligenceManager {
  private static instance: ScreenIntelligenceManager | null = null;
  private state: ScreenAwarenessState = {
    enabled: false,
    allowAnalysis: true,
    permissionStatus: 'prompt',
    isCapturing: false,
    isAnalyzing: false,
    screenDebugMode: false,
  };

  private listeners: Set<ScreenStateListener> = new Set();
  private logCallback: ScreenLogCallback | null = null;

  private constructor() {
    this.state.permissionStatus = screenPermissionManager.checkAvailability();

    screenCaptureManager.setOnStateChangeCallback((isCapturing) => {
      this.state.isCapturing = isCapturing;
      if (!isCapturing && this.state.enabled) {
        // Stream ended (e.g. user clicked browser stop share)
        this.notifyListeners();
      }
    });

    // Hydrate persisted user preference if available
    if (typeof localStorage !== 'undefined') {
      try {
        const savedEnabled = localStorage.getItem('myraa_screen_awareness_enabled');
        if (savedEnabled === 'true') {
          this.state.enabled = true;
        }
        const savedAllow = localStorage.getItem('myraa_screen_allow_analysis');
        if (savedAllow !== null) {
          this.state.allowAnalysis = savedAllow === 'true';
        }
      } catch {}
    }
  }

  public static getInstance(): ScreenIntelligenceManager {
    if (!ScreenIntelligenceManager.instance) {
      ScreenIntelligenceManager.instance = new ScreenIntelligenceManager();
    }
    return ScreenIntelligenceManager.instance;
  }

  public setLogCallback(callback: ScreenLogCallback): void {
    this.logCallback = callback;
  }

  private log(level: 'info' | 'warn' | 'error' | 'success', source: 'SCREEN' | 'VISION' | 'CODE_ANALYSIS', message: string): void {
    if (this.logCallback) {
      this.logCallback({ level, source, message: screenPrivacyManager.sanitizeLogMessage(message) });
    }
  }

  public subscribe(listener: ScreenStateListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const snapshot = { ...this.state };
    this.listeners.forEach((l) => l(snapshot));
  }

  public getState(): ScreenAwarenessState {
    return { ...this.state };
  }

  /**
   * Toggle Screen Awareness ON/OFF
   */
  public async toggleScreenAwareness(): Promise<boolean> {
    if (this.state.enabled) {
      this.state.enabled = false;
      screenCaptureManager.stopScreenCapture();
      this.log('info', 'SCREEN', 'Screen Awareness disabled by user');
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('myraa_screen_awareness_enabled', 'false');
      }
      this.notifyListeners();
      return false;
    } else {
      this.state.enabled = true;
      this.log('info', 'SCREEN', 'Requesting Screen Awareness activation');
      const reqRes = await screenCaptureManager.requestScreenCapture();
      this.state.permissionStatus = screenPermissionManager.getStatus();
      this.state.isCapturing = screenCaptureManager.isStreamingActive();

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('myraa_screen_awareness_enabled', 'true');
      }

      this.notifyListeners();
      return this.state.enabled;
    }
  }

  public setAllowAnalysis(allow: boolean): void {
    this.state.allowAnalysis = allow;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('myraa_screen_allow_analysis', String(allow));
    }
    this.notifyListeners();
  }

  public setScreenDebugMode(enabled: boolean): void {
    this.state.screenDebugMode = enabled;
    this.log('info', 'SCREEN', `Screen Debug Mode set to: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    this.notifyListeners();
  }

  /**
   * Evaluates if a voice or text query has screen awareness intent.
   */
  public isScreenIntent(text: string): boolean {
    const q = text.toLowerCase().trim();

    // Direct screen triggers
    if (
      q.includes('look at my screen') ||
      q.includes('look at the screen') ||
      q.includes('look at this') ||
      q.includes('look here') ||
      q.includes('see my screen') ||
      q.includes('what is on my screen') ||
      q.includes('what am i looking at') ||
      q.includes('what is this') ||
      q.includes("what's this")
    ) {
      return true;
    }

    // Code explanation triggers
    if (
      q.includes('explain this code') ||
      q.includes('what does this code do') ||
      q.includes('explain what this code does') ||
      q.includes('what programming language is this') ||
      q.includes('what language is this')
    ) {
      return true;
    }

    // Error & Debugging triggers
    if (
      q.includes("what's wrong here") ||
      q.includes('what is wrong here') ||
      q.includes("what's wrong with this") ||
      q.includes('why am i getting this error') ||
      q.includes('why is this failing') ||
      q.includes('what does this error mean') ||
      q.includes('debug this')
    ) {
      return true;
    }

    // Code change & consequence analysis
    if (
      q.includes('can i change this') ||
      q.includes('what happens if i change this') ||
      q.includes('what will happen if i change this') ||
      q.includes('what will the output be') ||
      q.includes('what is the output')
    ) {
      return true;
    }

    // Short-lived context follow-up (if active screen context exists)
    const existingContext = screenContextManager.getContext();
    if (existingContext && (codeAnalyzer.isCodeChangeQuery(q) || q.includes('line ') || q.includes('if i change'))) {
      return true;
    }

    return false;
  }

  /**
   * Handle on-demand screen understanding request.
   */
  public async handleScreenQuery(
    text: string,
    options?: { forceCapture?: boolean; systemInstruction?: string }
  ): Promise<{
    spokenResponse: string;
    audioBase64?: string | null;
    result?: ScreenUnderstandingResult;
  }> {
    // 1. Permission and enablement check
    if (!this.state.enabled || !this.state.allowAnalysis) {
      const guidance = screenPermissionManager.getPermissionGuidance();
      this.log('warn', 'SCREEN', 'Screen analysis requested but Screen Awareness is disabled or not granted');
      return {
        spokenResponse: guidance,
      };
    }

    this.state.isAnalyzing = true;
    this.notifyListeners();

    try {
      this.log('info', 'VISION', `Initiating on-demand screen analysis for: "${text}"`);

      // 2. Obtain current screen frame
      const frameData = await screenCaptureManager.captureCurrentFrame();

      if (!frameData) {
        // If capture failed, check if we have a recent valid short-lived context for follow-ups
        const shortLived = screenContextManager.getContext();
        if (shortLived) {
          this.log('info', 'VISION', 'Using active short-lived screen context for conversational follow-up');
          const visionRes = await geminiVisionAdapter.analyzeScreen({
            question: text,
            followUpContext: shortLived.result,
            detectedApp: this.state.detectedApp,
            screenDebugMode: this.state.screenDebugMode,
            systemInstruction: options?.systemInstruction,
          });

          this.state.isAnalyzing = false;
          this.state.lastAnalysisTimestamp = new Date().toISOString();
          this.notifyListeners();

          return {
            spokenResponse: visionRes.spokenText,
            audioBase64: visionRes.audioBase64,
            result: visionRes.result,
          };
        }

        this.state.isAnalyzing = false;
        this.notifyListeners();
        return {
          spokenResponse: "I couldn't read the screen just now, Chinna. Please make sure the window is visible and try asking again!",
        };
      }

      // 3. Screen change detection vs previous context
      const previousContext = screenContextManager.getContext();
      const hasChanged = screenContextManager.hasScreenChangedSubstantially(frameData.frameHash);
      if (hasChanged && previousContext) {
        this.log('info', 'SCREEN', 'Screen content changed substantially. Refreshing visual context.');
      }

      this.state.lastCaptureTimestamp = new Date().toISOString();

      // 4. Send frame to Gemini Multimodal Vision API
      const visionRes = await geminiVisionAdapter.analyzeScreen({
        imageBase64: frameData.rawBase64,
        mimeType: frameData.mimeType,
        question: text,
        followUpContext: hasChanged ? undefined : previousContext?.result,
        detectedApp: this.state.detectedApp,
        screenDebugMode: this.state.screenDebugMode,
        systemInstruction: options?.systemInstruction,
      });

      this.state.isAnalyzing = false;
      this.state.lastAnalysisTimestamp = new Date().toISOString();
      this.notifyListeners();

      if (visionRes.success && visionRes.result) {
        // Save to short-lived context (5 min TTL)
        screenContextManager.setContext(text, visionRes.result, frameData.frameHash);
        this.log(
          'success',
          'VISION',
          `Screen understood [${visionRes.result.category}]: ${visionRes.result.summary}`
        );
      }

      return {
        spokenResponse: visionRes.spokenText,
        audioBase64: visionRes.audioBase64,
        result: visionRes.result,
      };
    } catch (err: any) {
      console.error('[ScreenIntelligenceManager] Screen understanding error:', err);
      this.state.isAnalyzing = false;
      this.notifyListeners();
      return {
        spokenResponse: "I couldn't read the screen just now, Chinna. Could you try showing it to me again?",
      };
    }
  }

  public getCapabilities(): {
    screen_capture_available: boolean;
    screen_capture_permission: string;
    screen_analysis_available: boolean;
    gemini_multimodal_available: boolean;
  } {
    return {
      screen_capture_available: screenPermissionManager.checkAvailability() !== 'unavailable',
      screen_capture_permission: this.state.permissionStatus,
      screen_analysis_available: this.state.enabled && this.state.allowAnalysis,
      gemini_multimodal_available: true,
    };
  }
}

export const screenIntelligenceManager = ScreenIntelligenceManager.getInstance();
