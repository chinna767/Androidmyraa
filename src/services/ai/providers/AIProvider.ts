import { AIProviderType, AIRequest, AIResponse, ProviderTestResult, AISettings } from '../../../types';

export interface AIProvider {
  readonly name: AIProviderType;
  readonly displayName: string;

  /**
   * Check if this provider has credentials configured (either custom user key or server environment)
   */
  isConfigured(settings: AISettings): boolean;

  /**
   * Execute conversational generation
   */
  generateResponse(request: AIRequest, settings: AISettings): Promise<AIResponse>;

  /**
   * Test connection with a specified or saved API key
   */
  testConnection(apiKey?: string): Promise<ProviderTestResult>;
}
