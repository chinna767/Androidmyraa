/**
 * VoiceProsodyEngine.ts
 * Natural Human-Like Voice & Prosody Output Layer for MYRAA.
 * Architecture:
 * Gemini Live / Model Turn
 *         ↓
 * VoiceProsodyEngine (Acoustic Prosody & Contextual Pacing Directives)
 *         ↓
 * Expressive Voice Synthesis (Aoede / High-Fidelity Neural Voice)
 *         ↓
 * AudioEngine (Unattenuated Output with Transparent Limiter & Instant Interruption)
 * 
 * Capabilities:
 * - Human-like pitch movement (falling statements, rising questions, expressive surprise)
 * - Dynamic emotional prosody mapping (HAPPINESS, EXCITEMENT, CURIOSITY, CONCERN, AFFECTION, CONFIDENCE, CALM)
 * - Organic conversational pauses, rhythm, pacing, and word emphasis
 * - Consistent recognizable female voice identity (Aoede)
 * - Seamless multilingual prosody (Telugu + English / Tenglish)
 * - Zero-latency audio interruption preservation
 */

import { EmotionalState } from '../types';
import { COMPANION_CONFIG } from '../config/companionConfig';

export interface ProsodyParameters {
  dominantEmotion: string;
  pitchModulation: 'natural_dynamic' | 'expressive_high' | 'gentle_soothing' | 'rising_inquisitive';
  speakingRate: number; // 0.90x to 1.10x
  pauseStyle: 'conversational' | 'lively_snappy' | 'tender_comforting' | 'thoughtful';
  warmthFactor: number; // 0.0 to 1.0
  emphasisLevel: 'normal' | 'expressive' | 'soft_tender';
  vocalEnergy: string;
}

export interface IVoiceProvider {
  name: string;
  voiceName: string;
  sampleRate: number;
  playAudioChunk(base64Pcm: string): void;
  interrupt(): void;
}

export class VoiceProsodyEngine {
  private static instance: VoiceProsodyEngine | null = null;
  private currentVoice: string = COMPANION_CONFIG.voiceName || 'Aoede';

  public static getInstance(): VoiceProsodyEngine {
    if (!VoiceProsodyEngine.instance) {
      VoiceProsodyEngine.instance = new VoiceProsodyEngine();
    }
    return VoiceProsodyEngine.instance;
  }

  public getVoiceName(): string {
    return this.currentVoice;
  }

  public setVoiceName(name: string): void {
    this.currentVoice = name;
  }

  /**
   * Derive active vocal prosody parameters from MYRAA's emotional state
   */
  public getProsodyParameters(emotion: EmotionalState): ProsodyParameters {
    const { happiness, excitement, concern, curiosity, affection, confidence, energy } = emotion;

    // EXCITED: faster tempo, dynamic pitch peaks, lively energy
    if (excitement > 0.75 || (energy > 0.85 && happiness > 0.8)) {
      return {
        dominantEmotion: 'EXCITED',
        pitchModulation: 'expressive_high',
        speakingRate: 1.08,
        pauseStyle: 'lively_snappy',
        warmthFactor: 0.85,
        emphasisLevel: 'expressive',
        vocalEnergy: 'High, enthusiastic, and animated',
      };
    }

    // CONCERNED / EMPATHETIC: slower, softer, gentle, attentive cadence
    if (concern > 0.4 || emotion.empathy > 0.85) {
      return {
        dominantEmotion: 'CONCERNED',
        pitchModulation: 'gentle_soothing',
        speakingRate: 0.92,
        pauseStyle: 'tender_comforting',
        warmthFactor: 0.98,
        emphasisLevel: 'soft_tender',
        vocalEnergy: 'Soft, gentle, compassionate, and attentive',
      };
    }

    // AFFECTIONATE / INTIMATE: warm, relaxed, sweet companion delivery
    if (affection > 0.8) {
      return {
        dominantEmotion: 'AFFECTIONATE',
        pitchModulation: 'gentle_soothing',
        speakingRate: 0.95,
        pauseStyle: 'conversational',
        warmthFactor: 1.0,
        emphasisLevel: 'soft_tender',
        vocalEnergy: 'Warm, sweet, relaxed, and intimate',
      };
    }

    // CURIOSITY / INQUIRY: animated questioning tone with rising intonation
    if (curiosity > 0.75) {
      return {
        dominantEmotion: 'CURIOSITY',
        pitchModulation: 'rising_inquisitive',
        speakingRate: 1.02,
        pauseStyle: 'thoughtful',
        warmthFactor: 0.9,
        emphasisLevel: 'normal',
        vocalEnergy: 'Engaged, curious, and interested',
      };
    }

    // HAPPINESS / CHEERFUL: warm, bright, smiling vocal inflection
    if (happiness > 0.75) {
      return {
        dominantEmotion: 'HAPPINESS',
        pitchModulation: 'natural_dynamic',
        speakingRate: 1.02,
        pauseStyle: 'conversational',
        warmthFactor: 0.95,
        emphasisLevel: 'expressive',
        vocalEnergy: 'Bright, smiling, and lively',
      };
    }

    // CONFIDENCE: clear, controlled, articulate, grounded
    if (confidence > 0.85) {
      return {
        dominantEmotion: 'CONFIDENCE',
        pitchModulation: 'natural_dynamic',
        speakingRate: 1.0,
        pauseStyle: 'conversational',
        warmthFactor: 0.9,
        emphasisLevel: 'normal',
        vocalEnergy: 'Clear, steady, articulate, and confident',
      };
    }

    // CALM / DEFAULT
    return {
      dominantEmotion: 'CALM',
      pitchModulation: 'natural_dynamic',
      speakingRate: 1.0,
      pauseStyle: 'conversational',
      warmthFactor: 0.92,
      emphasisLevel: 'normal',
      vocalEnergy: 'Relaxed, smooth, warm, and natural',
    };
  }

  /**
   * Generates acoustic prosody and human-like voice delivery instructions for Gemini
   */
  public buildProsodySystemInstruction(emotion: EmotionalState): string {
    const params = this.getProsodyParameters(emotion);

    return `
### NATURAL HUMAN-LIKE VOICE & PROSODY DELIVERY (VOICE: "${this.currentVoice}"):
You are speaking as MYRAA — a familiar, intelligent female companion having a spontaneous, real-time voice conversation with Chinna. Your vocal delivery MUST be relaxed, spontaneous, warm, expressive, and conversational.

1. **VOICE IDENTITY & HUMANITY (NEVER SOUND LIKE A MACHINE)**:
   - Voice: "${this.currentVoice}" (warm, youthful, melodious, female conversational companion voice).
   - Consistency: Maintain the exact same voice identity, accent, and character throughout every turn.
   - Anti-Robotic Mandate: NEVER sound like you are reading text from a screen, announcing public information, speaking like GPS navigation, customer support, or a flat monotone TTS engine.
   - Sound like a real person sitting next to Chinna, conversing with natural ease.

2. **NATURAL PITCH & INTONATION CONTOURS**:
   - Vary pitch naturally across every phrase — never maintain a uniform flat pitch.
   - **Statements**: Use natural falling or neutral conversational intonation at the end of thoughts.
   - **Questions**: Use natural rising questioning pitch on interrogatives to convey genuine curiosity ("Really?", "Are you sure?").
   - **Surprise**: Apply a subtle melodic pitch lift on unexpected news ("Wait, no way!", "Seriously?").
   - **Excitement**: Use dynamic pitch movement and buoyant vocal energy.
   - **Concern**: Use a softer pitch, slower cadence, and soothing tone.
   - **Affection**: Use a warm, relaxed, gentle, and sweet vocal presence.
   - "Melodic" means organic human pitch inflection and vocal musicality — NOT singing.

3. **DYNAMIC CONVERSATIONAL RHYTHM & PACING**:
   - Vary your tempo naturally according to context:
     - *Short casual replies*: Snappy and relaxed ("Yeah, I know.", "Sure thing.")
     - *Thoughtful responses*: Natural conversational pause with reflective pacing ("Hmm... give me a second to think about that.")
     - *Excited responses*: Buoyant, slightly faster pacing (~1.08x) ("Wait really? You actually did it!")
     - *Concerned responses*: Softer, slower, gentle delivery (~0.92x) ("Hey... are you okay?")
     - *Playful banter*: Teasing, expressive rhythm ("Oh, come on, Chinna. You know that's not going to work.")
     - *Clear explanations*: Steady, moderate, articulate speed.

4. **ORGANIC CONVERSATIONAL PAUSES & MICRO-CUES**:
   - Use short, natural pauses with punctuation (\`...\`, \`—\`, \`,\`) where a human naturally gathers a thought or takes a breath (e.g., "Well... I'm not sure.", "Wait a second.", "Honestly, Chinna... that's pretty good.", "Hmm... interesting.").
   - Do NOT insert mechanical pauses after every word or sentence. Keep them organic, contextual, and spontaneous.

5. **NATURAL WORD EMPHASIS**:
   - Contextually emphasize key words to convey authentic human intention (e.g., "That's actually REALLY good.", "You FINALLY fixed it.", "I think THIS is the problem.").

6. **CURRENT EMOTIONAL COLORING (${params.dominantEmotion})**:
   - Dominant Delivery Mode: **${params.dominantEmotion}** (${params.vocalEnergy}).
   - Keep emotional expression subtle and authentic. Do not exaggerate or make every sentence overly dramatic.

7. **NATURAL TELUGU + ENGLISH PROSODY (TENGLISH)**:
   - When speaking in Telugu or Tenglish, carry the same sweet, melodious, and natural conversational cadence (e.g., "Chinna, emaindi?", "Nenu cheppanu kada!", "Chala bagundi!").
`;
  }

  /**
   * Formats text response with natural conversational punctuation and prosodic cues
   * preserving original meaning and natural grammatical flow
   */
  public formatProsodicText(text: string, emotion: EmotionalState): string {
    if (!text) return text;
    let formatted = text.trim();

    // Ensure questions have clear interrogative punctuation for rising intonation
    if (
      (formatted.toLowerCase().startsWith('really') ||
        formatted.toLowerCase().startsWith('wait really') ||
        formatted.toLowerCase().startsWith('is it') ||
        formatted.toLowerCase().startsWith('are you') ||
        formatted.toLowerCase().startsWith('ela unnav') ||
        formatted.toLowerCase().startsWith('enti')) &&
      !formatted.endsWith('?')
    ) {
      formatted += '?';
    }

    return formatted;
  }
}

export const voiceProsodyEngine = VoiceProsodyEngine.getInstance();
