import { apiUrl } from '../../../config/backendConfig';
import { AIProvider } from './AIProvider';
import { AIProviderType, AIRequest, AIResponse, ProviderTestResult, AISettings } from '../../../types';

export class GrokProvider implements AIProvider {
  public readonly name: AIProviderType = 'grok';
  public readonly displayName: string = 'Grok (xAI)';

  public isConfigured(settings: AISettings): boolean {
    return !!(settings.grokApiKey && settings.grokApiKey.trim().length > 0);
  }

  public async generateResponse(request: AIRequest, settings: AISettings): Promise<AIResponse> {
    if (!settings.grokApiKey || settings.grokApiKey.trim().length === 0) {
      const err = new Error('Grok API key is missing. Please configure your key in AI API Settings.') as any;
      err.isMissingKey = true;
      throw err;
    }

    const payload = {
      provider: 'grok',
      prompt: request.prompt,
      systemInstruction: request.systemInstruction,
      voice: request.voice || 'Aoede',
      temperature: request.temperature ?? 0.7,
      apiKey: settings.grokApiKey,
    };

    const res = await fetch(apiUrl('/api/companion/converse'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorMsg = errData.error || `Grok API returned status ${res.status}`;
      const err = new Error(errorMsg) as any;
      err.statusCode = res.status;
      err.isRateLimit = res.status === 429 || errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('quota');
      err.isTemporary = res.status >= 500 || res.status === 429 || res.status === 408;
      throw err;
    }

    const data = await res.json();
    return {
      text: data.text || "I'm right here with you, Chinna.",
      audio: data.audio || null,
      providerUsed: 'grok',
    };
  }

  public async testConnection(apiKey?: string): Promise<ProviderTestResult> {
    const startTime = performance.now();
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        provider: 'grok',
        success: false,
        message: 'Grok API key is empty',
        latencyMs: 0,
      };
    }

    try {
      const res = await fetch(apiUrl('/api/ai/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'grok',
          apiKey: apiKey.trim(),
        }),
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        return {
          provider: 'grok',
          success: true,
          message: 'Grok connected',
          latencyMs,
        };
      } else {
        return {
          provider: 'grok',
          success: false,
          message: data.error || 'Grok connection failed',
          latencyMs,
        };
      }
    } catch (err: any) {
      return {
        provider: 'grok',
        success: false,
        message: 'Grok connection failed (Network error)',
        latencyMs: Math.round(performance.now() - startTime),
      };
    }
  }
}

export const grokProvider = new GrokProvider();
