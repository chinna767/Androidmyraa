import { ScreenContextSnapshot, ScreenUnderstandingResult } from '../../types';
import { screenFrameProcessor } from './ScreenFrameProcessor';

export class ScreenContextManager {
  private static instance: ScreenContextManager | null = null;
  private currentSnapshot: ScreenContextSnapshot | null = null;
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes short-lived context

  private constructor() {}

  public static getInstance(): ScreenContextManager {
    if (!ScreenContextManager.instance) {
      ScreenContextManager.instance = new ScreenContextManager();
    }
    return ScreenContextManager.instance;
  }

  /**
   * Save the latest screen understanding as short-lived conversation context.
   */
  public setContext(
    userQuery: string,
    result: ScreenUnderstandingResult,
    frameHash?: string,
    ttlMs = this.DEFAULT_TTL_MS
  ): void {
    this.currentSnapshot = {
      timestamp: Date.now(),
      userQuery,
      result,
      frameHash,
      ttlMs,
    };
  }

  /**
   * Returns active short-lived context if not expired.
   */
  public getContext(): ScreenContextSnapshot | null {
    if (!this.currentSnapshot) return null;
    const isExpired = Date.now() - this.currentSnapshot.timestamp > this.currentSnapshot.ttlMs;
    if (isExpired) {
      this.currentSnapshot = null;
      return null;
    }
    return this.currentSnapshot;
  }

  /**
   * Checks if the screen has changed substantially compared to the last analyzed snapshot.
   */
  public hasScreenChangedSubstantially(newFrameHash?: string): boolean {
    if (!this.currentSnapshot || !this.currentSnapshot.frameHash || !newFrameHash) {
      return true;
    }
    const diff = screenFrameProcessor.calculateHashDifference(
      this.currentSnapshot.frameHash,
      newFrameHash
    );
    // If more than 35% of perceptual hash bits differ, the screen changed substantially
    return diff > 0.35;
  }

  /**
   * Clear short-lived screen context when no longer relevant.
   */
  public clearContext(): void {
    this.currentSnapshot = null;
  }
}

export const screenContextManager = ScreenContextManager.getInstance();
