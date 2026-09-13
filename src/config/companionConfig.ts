export const COMPANION_CONFIG = {
  name: 'MYRAA',
  title: 'Real-Time Voice Companion',
  primaryUser: 'Chinna',
  // Gemini Live Model
  model: 'gemini-3.1-flash-live-preview',
  fallbackModel: 'gemini-3.8-flash',
  // Voice name for Gemini speech output (Aoede: breezy, melodic, expressive female voice)
  voiceName: 'Aoede',
  // Melodic Prosody Configuration
  prosody: {
    style: 'melodic_conversational',
    dynamicPitchVariation: true,
    naturalPauses: true,
    sampleRate: 24000,
  },
  // Output Sample Rate & Voice Gain
  inputSampleRate: 16000, // 16kHz mono 16-bit PCM for Gemini Live input
  outputSampleRate: 24000, // 24kHz PCM for Gemini Live output
  chunkSize: 1024, // Optimized chunk size
  bufferSize: 2048, // Web Audio processor buffer size
  // Application Gain & Stream Configuration (1.0 = 100% full unattenuated volume)
  MYRAA_OUTPUT_GAIN: 1.0,
  audioStreamType: 'STREAM_MUSIC', // Android media playback stream
  pcmEncoding: '16-bit Linear PCM (Little-Endian)',
  channelCount: 1, // Mono speech
  // Speech & Interruption Thresholds
  userSpeakingThresholdDb: -42, // dB threshold for speech detection
  silenceThresholdDb: -55,
  silenceThresholdMs: 800,
  voiceActivityThresholdDb: -42,
  // Wake words (Single word: "Myraa")
  wakeWords: ['Myraa', 'Myra', 'Mira'],
  // Default baseline emotions
  baselineEmotions: {
    happiness: 0.85,
    affection: 0.85,
    curiosity: 0.75,
    energy: 0.80,
    confidence: 0.90,
  },
};
