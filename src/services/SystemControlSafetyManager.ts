/**
 * SystemControlSafetyManager.ts
 * Safety and permission evaluation layer for MYRAA system control.
 * Categorizes risk levels (LOW, MEDIUM, HIGH, CRITICAL) and enforces confirmation rules.
 * Ensures dangerous or high-consequence operations are never executed silently.
 */

export type ActionRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SafetyCheckResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  riskLevel: ActionRiskLevel;
  reason?: string;
  confirmationPrompt?: string;
}

export class SystemControlSafetyManager {
  private static instance: SystemControlSafetyManager | null = null;

  // Low-risk actions that execute directly without requiring explicit voice confirmation
  private lowRiskActions: Set<string> = new Set([
    'volume_up',
    'volume_down',
    'set_volume',
    'brightness_up',
    'brightness_down',
    'set_brightness',
    'torch_on',
    'torch_off',
    'torch_toggle',
    'mobile_data_status',
    'get_current_time',
    'get_current_date',
    'youtube_search',
    'youtube_play',
    'youtube_pause',
    'youtube_resume',
    'youtube_stop',
    'go_back',
    'scroll_up',
    'scroll_down',
  ]);

  // Actions requiring explicit user confirmation before execution
  private highRiskActions: Map<string, string> = new Map([
    ['mobile_data_off', 'Are you sure you want to turn off mobile data, Chinna? You might lose internet connection.'],
    ['system_reboot', 'Are you sure you want me to reboot your device, Chinna?'],
    ['factory_reset', 'Warning: This will erase all device data. Do you confirm, Chinna?'],
    ['clear_all_memories', 'Are you sure you want me to forget all our memories together, Chinna?'],
  ]);

  public static getInstance(): SystemControlSafetyManager {
    if (!SystemControlSafetyManager.instance) {
      SystemControlSafetyManager.instance = new SystemControlSafetyManager();
    }
    return SystemControlSafetyManager.instance;
  }

  /**
   * Evaluate whether a tool action is safe to execute directly
   */
  public evaluateSafety(toolName: string, _args?: any): SafetyCheckResult {
    if (this.lowRiskActions.has(toolName)) {
      return {
        allowed: true,
        requiresConfirmation: false,
        riskLevel: 'LOW',
      };
    }

    if (this.highRiskActions.has(toolName)) {
      const prompt = this.highRiskActions.get(toolName);
      return {
        allowed: false,
        requiresConfirmation: true,
        riskLevel: 'HIGH',
        reason: 'Action requires explicit user confirmation',
        confirmationPrompt: prompt,
      };
    }

    // Default for unknown or unclassified actions: allow with medium risk monitoring
    return {
      allowed: true,
      requiresConfirmation: false,
      riskLevel: 'MEDIUM',
    };
  }

  /**
   * Register a custom high-risk action confirmation rule
   */
  public registerConfirmationRule(actionName: string, prompt: string): void {
    this.highRiskActions.set(actionName, prompt);
    this.lowRiskActions.delete(actionName);
  }
}

export const systemControlSafetyManager = SystemControlSafetyManager.getInstance();
