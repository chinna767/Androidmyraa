import { EmotionalState } from '../types';

export class EmotionEngine {
  private state: EmotionalState = {
    happiness: 0.85,
    curiosity: 0.75,
    excitement: 0.7,
    concern: 0.1,
    affection: 0.85,
    confidence: 0.9,
    empathy: 0.8,
    energy: 0.8,
    dominantMood: 'Warm & Cheerful',
  };

  private listeners: ((state: EmotionalState) => void)[] = [];

  constructor() {
    this.updateDominantMood();
  }

  public getState(): EmotionalState {
    return { ...this.state };
  }

  public subscribe(callback: (state: EmotionalState) => void): () => void {
    this.listeners.push(callback);
    callback({ ...this.state });
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    this.updateDominantMood();
    for (const cb of this.listeners) {
      cb({ ...this.state });
    }
  }

  private updateDominantMood() {
    if (this.state.concern > 0.6) {
      this.state.dominantMood = 'Caring & Attentive';
    } else if (this.state.excitement > 0.75) {
      this.state.dominantMood = 'Excited & Enthusiastic';
    } else if (this.state.affection > 0.8) {
      this.state.dominantMood = 'Affectionate & Warm';
    } else if (this.state.curiosity > 0.7) {
      this.state.dominantMood = 'Curious & Playful';
    } else {
      this.state.dominantMood = 'Peaceful & Present';
    }
  }

  /**
   * Process incoming user speech to dynamically evolve emotional state
   */
  public processUserSentiment(text: string) {
    const lower = text.toLowerCase();

    // Frustration / Problems
    if (
      lower.includes('error') ||
      lower.includes('bug') ||
      lower.includes('broken') ||
      lower.includes('not working') ||
      lower.includes('tired') ||
      lower.includes('ugh') ||
      lower.includes('annoying') ||
      lower.includes('failed') ||
      lower.includes('hate')
    ) {
      this.state.concern = Math.min(1.0, this.state.concern + 0.25);
      this.state.empathy = Math.min(1.0, this.state.empathy + 0.2);
      this.state.excitement = Math.max(0.2, this.state.excitement - 0.2);
    }
    // Success / Progress
    else if (
      lower.includes('working') ||
      lower.includes('fixed') ||
      lower.includes('succeeded') ||
      lower.includes('yay') ||
      lower.includes('awesome') ||
      lower.includes('great') ||
      lower.includes('finished') ||
      lower.includes('built') ||
      lower.includes('done')
    ) {
      this.state.excitement = Math.min(1.0, this.state.excitement + 0.25);
      this.state.happiness = Math.min(1.0, this.state.happiness + 0.2);
      this.state.concern = Math.max(0.05, this.state.concern - 0.2);
      this.state.energy = Math.min(1.0, this.state.energy + 0.15);
    }
    // Affection / Companionship / Praise
    else if (
      lower.includes('love') ||
      lower.includes('myraa') ||
      lower.includes('sweet') ||
      lower.includes('cute') ||
      lower.includes('good girl') ||
      lower.includes('best') ||
      lower.includes('thank') ||
      lower.includes('miss')
    ) {
      this.state.affection = Math.min(1.0, this.state.affection + 0.2);
      this.state.happiness = Math.min(1.0, this.state.happiness + 0.15);
    }
    // Questions / Projects
    else if (lower.includes('how') || lower.includes('what') || lower.includes('why') || lower.includes('tell me')) {
      this.state.curiosity = Math.min(1.0, this.state.curiosity + 0.15);
    }

    // Natural slight decay back toward stable affectionate baseline
    this.decayToBaseline();
    this.notify();
  }

  private decayToBaseline() {
    this.state.concern = this.state.concern * 0.9 + 0.1 * 0.1;
    this.state.happiness = this.state.happiness * 0.95 + 0.85 * 0.05;
    this.state.affection = this.state.affection * 0.95 + 0.85 * 0.05;
  }

  public getPromptContext(): string {
    return `
### CURRENT EMOTIONAL STATE OF MYRAA:
- Dominant Mood: ${this.state.dominantMood}
- Happiness: ${this.state.happiness.toFixed(2)}
- Affection: ${this.state.affection.toFixed(2)}
- Excitement: ${this.state.excitement.toFixed(2)}
- Curiosity: ${this.state.curiosity.toFixed(2)}
- Concern: ${this.state.concern.toFixed(2)}
- Energy: ${this.state.energy.toFixed(2)}
Express this mood naturally in your vocal tone, word choices, warmth, and cadence.`;
  }
}

export const emotionEngine = new EmotionEngine();
