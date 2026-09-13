import { AIProvider } from './AIProvider';
import { AIProviderType, AIRequest, AIResponse, ProviderTestResult, AISettings } from '../../../types';

export class GeminiProvider implements AIProvider {
  public readonly name: AIProviderType = 'gemini';
  public readonly displayName: string = 'Gemini';

  public isConfigured(settings: AISettings): boolean {
    // User key is configured OR server has environment key
    return !!(settings.geminiApiKey && settings.geminiApiKey.trim().length > 0);
  }

  public async generateResponse(request: AIRequest, settings: AISettings): Promise<AIResponse> {
    const startTime = performance.now();
    const payload = {
      provider: 'gemini',
      prompt: request.prompt,
      systemInstruction: request.systemInstruction,
      voice: request.voice || 'Aoede',
      temperature: request.temperature ?? 0.8,
      apiKey: settings.geminiApiKey || undefined,
    };

    const res = await fetch('/api/companion/converse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorMsg = errData.error || `Gemini API returned status ${res.status}`;
      const err = new Error(errorMsg) as any;
      err.statusCode = res.status;
      err.isRateLimit = res.status === 429 || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('rate limit');
      err.isTemporary = res.status >= 500 || res.status === 429 || res.status === 408;
      throw err;
    }

    const data = await res.json();
    return {
      text: data.text || "I'm right here with you, Chinna.",
      audio: data.audio || null,
      providerUsed: 'gemini',
    };
  }

  public async testConnection(apiKey?: string): Promise<ProviderTestResult> {
    const startTime = performance.now();
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'gemini',
          apiKey: apiKey || undefined,
        }),
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        return {
          provider: 'gemini',
          success: true,
          message: 'Gemini connected',
          latencyMs,
        };
      } else {
        return {
          provider: 'gemini',
          success: false,
          message: data.error || 'Gemini connection failed',
          latencyMs,
        };
      }
    } catch (err: any) {
      return {
        provider: 'gemini',
        success: false,
        message: 'Gemini connection failed (Network error)',
        latencyMs: Math.round(performance.now() - startTime),
      };
    }
  }
}

export const geminiProvider = new GeminiProvider();
