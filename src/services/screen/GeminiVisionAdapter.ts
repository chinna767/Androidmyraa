import { ScreenUnderstandingResult } from '../../types';
import { screenPrivacyManager } from './ScreenPrivacyManager';

export interface VisionAnalysisParams {
  imageBase64?: string;
  mimeType?: string;
  question: string;
  followUpContext?: any;
  detectedApp?: string;
  screenDebugMode?: boolean;
  systemInstruction?: string;
}

export interface VisionAnalysisResponse {
  success: boolean;
  result?: ScreenUnderstandingResult;
  spokenText: string;
  audioBase64?: string | null;
  error?: string;
}

export class GeminiVisionAdapter {
  private static instance: GeminiVisionAdapter | null = null;

  private constructor() {}

  public static getInstance(): GeminiVisionAdapter {
    if (!GeminiVisionAdapter.instance) {
      GeminiVisionAdapter.instance = new GeminiVisionAdapter();
    }
    return GeminiVisionAdapter.instance;
  }

  /**
   * Send multimodal screen frame + question to backend Gemini Vision endpoint.
   */
  public async analyzeScreen(params: VisionAnalysisParams): Promise<VisionAnalysisResponse> {
    try {
      const response = await fetch('/api/screen/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: params.imageBase64,
          mimeType: params.mimeType || 'image/jpeg',
          question: screenPrivacyManager.sanitizeLogMessage(params.question),
          followUpContext: params.followUpContext,
          detectedApp: params.detectedApp,
          screenDebugMode: params.screenDebugMode || false,
          systemInstruction: params.systemInstruction,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      const result = data.result as ScreenUnderstandingResult;
      const spokenText = data.text || result?.spokenResponse || "I've analyzed your screen, Chinna.";
      const audioBase64 = data.audio || null;

      return {
        success: true,
        result: {
          ...result,
          timestamp: Date.now(),
        },
        spokenText,
        audioBase64,
      };
    } catch (err: any) {
      console.warn('[GeminiVisionAdapter] Vision analysis request failed:', err);
      return {
        success: false,
        spokenText: "I couldn't read the screen just now, Chinna. Could you try showing it to me again?",
        error: err.message || 'Vision analysis failed',
      };
    }
  }
}

export const geminiVisionAdapter = GeminiVisionAdapter.getInstance();
