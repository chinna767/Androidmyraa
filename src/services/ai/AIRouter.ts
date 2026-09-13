import { AIProviderType, AIRequest, AIResponse, AISettings, ProviderTestResult } from '../../types';
import { aiSettingsStorage } from './AISettingsStorage';
import { geminiProvider } from './providers/GeminiProvider';
import { grokProvider } from './providers/GrokProvider';
import { AIProvider } from './providers/AIProvider';

export type FallbackNoticeListener = (notice: {
  fromProvider: AIProviderType;
  toProvider: AIProviderType;
  reason: string;
  message: string;
}) => void;

export class AIRouter {
  private providers: Record<AIProviderType, AIProvider> = {
    gemini: geminiProvider,
    grok: grokProvider,
  };

  private fallbackListeners: Set<FallbackNoticeListener> = new Set();

  public subscribeFallbackNotice(listener: FallbackNoticeListener): () => void {
    this.fallbackListeners.add(listener);
    return () => this.fallbackListeners.delete(listener);
  }

  private emitFallbackNotice(
    fromProvider: AIProviderType,
    toProvider: AIProviderType,
    reason: string,
    message: string
  ): void {
    for (const listener of this.fallbackListeners) {
      try {
        listener({ fromProvider, toProvider, reason, message });
      } catch (e) {
        console.warn('[AIRouter] Listener notice:', e);
      }
    }
  }

  /**
   * Get active settings
   */
  public getSettings(): AISettings {
    return aiSettingsStorage.getSettings();
  }

  /**
   * Update and save settings
   */
  public updateSettings(updated: Partial<AISettings>): AISettings {
    return aiSettingsStorage.saveSettings(updated);
  }

  /**
   * Permanently delete a key for a provider
   */
  public clearKey(provider: AIProviderType): AISettings {
    return aiSettingsStorage.clearKey(provider);
  }

  /**
   * Sync settings with backend persistent storage
   */
  public async syncWithServer(): Promise<AISettings> {
    return aiSettingsStorage.syncWithServer();
  }

  /**
   * Subscribe to settings changes (e.g. from server sync)
   */
  public subscribeSettings(listener: (settings: AISettings) => void): () => void {
    return aiSettingsStorage.subscribe(listener);
  }

  /**
   * Get current primary provider
   */
  public getPreferredProvider(): AIProviderType {
    return this.getSettings().preferredProvider || 'gemini';
  }

  /**
   * Check if an error is a recoverable failure suitable for automatic fallback
   */
  private isRecoverableError(err: any): boolean {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    const status = err.statusCode || 0;

    return (
      status === 429 ||
      status === 503 ||
      status === 502 ||
      status === 504 ||
      status === 408 ||
      err.isRateLimit ||
      err.isTemporary ||
      err.isMissingKey ||
      msg.includes('rate limit') ||
      msg.includes('quota') ||
      msg.includes('resource_exhausted') ||
      msg.includes('temporarily unavailable') ||
      msg.includes('overloaded') ||
      msg.includes('timeout') ||
      msg.includes('network')
    );
  }

  /**
   * Generate conversational response routing to primary provider and handling auto-fallback
   */
  public async converse(request: AIRequest): Promise<AIResponse> {
    const settings = this.getSettings();
    const primaryProviderType = settings.preferredProvider || 'gemini';
    const fallbackProviderType: AIProviderType =
      primaryProviderType === 'gemini' ? 'grok' : 'gemini';

    const primaryProvider = this.providers[primaryProviderType];
    const fallbackProvider = this.providers[fallbackProviderType];

    // Attempt 1: Primary Provider
    try {
      const response = await primaryProvider.generateResponse(request, settings);
      return response;
    } catch (primaryErr: any) {
      console.warn(
        `[AIRouter] Primary provider (${primaryProviderType}) notice:`,
        primaryErr.message || primaryErr
      );

      // Check if automatic fallback is enabled and error is recoverable
      const shouldFallback =
        settings.automaticFallback && this.isRecoverableError(primaryErr);

      if (!shouldFallback) {
        // Fallback not enabled or non-recoverable: throw friendly error
        throw primaryErr;
      }

      // Check if fallback provider is configured
      const isFallbackConfigured = fallbackProvider.isConfigured(settings);
      if (!isFallbackConfigured && fallbackProviderType === 'grok') {
        const errorMsg = `Gemini is unavailable, and Grok API key is not configured in AI API Settings.`;
        console.warn(`[AIRouter] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Generate human-friendly fallback notice
      let fallbackReason = 'Temporary provider failure';
      let noticeMessage = `${primaryProvider.displayName} is temporarily unavailable. Trying ${fallbackProvider.displayName}...`;

      if (
        primaryErr.statusCode === 429 ||
        (primaryErr.message && primaryErr.message.toLowerCase().includes('rate limit')) ||
        (primaryErr.message && primaryErr.message.toLowerCase().includes('quota'))
      ) {
        fallbackReason = 'Rate limit / Quota exceeded';
        noticeMessage = `${primaryProvider.displayName} API limit reached. Switching to ${fallbackProvider.displayName}...`;
      }

      this.emitFallbackNotice(
        primaryProviderType,
        fallbackProviderType,
        fallbackReason,
        noticeMessage
      );

      // Attempt 2: Fallback Provider
      try {
        const fallbackRes = await fallbackProvider.generateResponse(request, settings);
        return {
          ...fallbackRes,
          fallbackTriggered: true,
          fallbackReason: noticeMessage,
        };
      } catch (fallbackErr: any) {
        console.error(
          `[AIRouter] Fallback provider (${fallbackProviderType}) failed:`,
          fallbackErr.message || fallbackErr
        );
        throw new Error(
          `Both AI providers (${primaryProvider.displayName} and ${fallbackProvider.displayName}) are unavailable. Please check your network and API keys in AI API Settings.`
        );
      }
    }
  }

  /**
   * Test connection to a specific provider
   */
  public async testProvider(
    provider: AIProviderType,
    apiKey?: string
  ): Promise<ProviderTestResult> {
    const p = this.providers[provider];
    if (!p) {
      return {
        provider,
        success: false,
        message: 'Unknown provider',
      };
    }
    return await p.testConnection(apiKey);
  }
}

export const aiRouter = new AIRouter();
