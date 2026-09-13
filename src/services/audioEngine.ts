/**
 * audioEngine.ts
 * Production-ready Web Audio Engine managing:
 * - 16kHz Mono Microphone Audio Capture with echo cancellation, noise suppression & auto gain
 * - 24kHz High-Fidelity Audio Playback with jitter buffer scheduling
 * - Direct Float32 sample pipe for Neural VAD and Neural Wake-Word inference
 * - Zero-latency Barge-In / Interruption audio cut-off
 * - Clean resource lifecycle management (safe suspend, resume, and release)
 */

import { COMPANION_CONFIG } from '../config/companionConfig';
import { AudioTrackDiagnostics } from '../types';

export interface LiveAudioDiagnostics {
  audioContextSampleRate: number;
  micSampleRate: number;
  channelCount: number;
  isMono: boolean;
  bufferSize: number;
  rawRms: number;
  rawRmsDb: number;
  peakAmplitude: number;
  averageAmplitude: number;
  inputSampleRate: number;
  targetSampleRate: number;
  resampledSampleRate: number;
  numSamples: number;
  pcmRange: string;
  minPcm: number;
  maxPcm: number;
  meanPcm: number;
}

export interface AudioInputProcessingTelemetry {
  audioContextSampleRate: number;
  micSampleRate: number;
  channelCount: number;
  isMono: boolean;
  bufferSize: number;
  rawRms: number;
  peakAmplitude: number;
  averageAmplitude: number;
  inputSampleRate: number;
  targetSampleRate: number;
  resampledSampleRate: number;
  numSamples: number;
  pcmRange: string;
  minPcm: number;
  maxPcm: number;
  meanPcm: number;
}

export interface AudioEngineCallbacks {
  onAudioChunk: (base64Pcm: string) => void;
  onRawSamples?: (samples: Float32Array, telemetry?: AudioInputProcessingTelemetry) => void;
  onInputVolume: (level: number, db: number) => void;
  onOutputVolume: (level: number, db: number) => void;
  onPlaybackStateChange: (isPlaying: boolean) => void;
  onError: (error: string) => void;
}

export class AudioEngine {
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private outputGainNode: GainNode | null = null;
  private lowCutFilter: BiquadFilterNode | null = null;
  private warmthFilter: BiquadFilterNode | null = null;
  private clarityFilter: BiquadFilterNode | null = null;
  private airFilter: BiquadFilterNode | null = null;
  private vocalLimiter: DynamicsCompressorNode | null = null;
  private applicationGain: number = COMPANION_CONFIG.MYRAA_OUTPUT_GAIN || 1.0;
  private lastOutputDb: number = -100;
  private activeSources: AudioBufferSourceNode[] = [];
  private nextStartTime: number = 0;
  private isMuted: boolean = false;
  private isRecording: boolean = false;
  private isPlayingAudio: boolean = false;
  private isGeminiStreamingActive: boolean = false;
  private animationFrameId: number | null = null;
  private callbacks: AudioEngineCallbacks;
  private lastAudioFrameTime: number = 0;
  private micStatus: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PERMISSION_DENIED' = 'INACTIVE';
  private micLifecycle: 'OFF' | 'STARTING' | 'ON' | 'STOPPING' = 'OFF';
  private silentSinkNode: GainNode | null = null;
  private totalFramesProcessed: number = 0;
  private liveAudioDiagnostics: LiveAudioDiagnostics = {
    audioContextSampleRate: 16000,
    micSampleRate: 16000,
    channelCount: 1,
    isMono: true,
    bufferSize: 2048,
    rawRms: 0,
    rawRmsDb: -100,
    peakAmplitude: 0,
    averageAmplitude: 0,
    inputSampleRate: 16000,
    targetSampleRate: 16000,
    resampledSampleRate: 16000,
    numSamples: 2048,
    pcmRange: '[-1.0, 1.0] Float32',
    minPcm: 0,
    maxPcm: 0,
    meanPcm: 0,
  };

  constructor(callbacks: AudioEngineCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Returns whether the microphone is actively capturing and streaming frames
   */
  public isMicrophoneActive(): boolean {
    const isLive =
      this.isRecording &&
      this.micStream !== null &&
      this.micStream.active &&
      this.micStream.getAudioTracks().some((t) => t.readyState === 'live' && t.enabled) &&
      this.inputContext !== null &&
      this.inputContext.state === 'running';
    return !!isLive;
  }

  public getMicStatus(): 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PERMISSION_DENIED' {
    if (!this.isRecording || !this.micStream || !this.inputContext) {
      return this.micStatus === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED' : 'INACTIVE';
    }
    if (this.inputContext.state === 'suspended') {
      return 'INACTIVE';
    }
    const hasLiveTrack = this.micStream.getAudioTracks().some((t) => t.readyState === 'live' && t.enabled);
    if (!hasLiveTrack) {
      return 'INACTIVE';
    }
    return 'ACTIVE';
  }

  public getLastAudioFrameTime(): number {
    return this.lastAudioFrameTime;
  }

  public getTotalFramesProcessed(): number {
    return this.totalFramesProcessed;
  }

  public getLiveAudioDiagnostics(): LiveAudioDiagnostics {
    return { ...this.liveAudioDiagnostics };
  }

  /**
   * Explicitly resume AudioContext if browser suspended it (e.g. backgrounding or tab switch)
   */
  public async resumeInputContext(): Promise<boolean> {
    try {
      if (this.inputContext && this.inputContext.state === 'suspended') {
        await this.inputContext.resume();
      }
      if (this.outputContext && this.outputContext.state === 'suspended') {
        await this.outputContext.resume();
      }
      return this.isMicrophoneActive();
    } catch (e) {
      console.warn('[AudioEngine] Failed to resume AudioContext:', e);
      return false;
    }
  }

  /**
   * Set explicit application-level output gain (1.0 = 100% full volume, safe range 0.0 to 2.0)
   */
  public setOutputGain(gain: number): void {
    const clampedGain = Math.max(0.0, Math.min(2.0, gain));
    this.applicationGain = clampedGain;
    if (this.outputGainNode && this.outputContext) {
      this.outputGainNode.gain.setValueAtTime(clampedGain, this.outputContext.currentTime);
    }
  }

  public getOutputGain(): number {
    return this.applicationGain;
  }

  /**
   * Diagnostic details for AudioTrack and Output Stream
   */
  public getAudioTrackDiagnostics(): AudioTrackDiagnostics {
    const trackState = this.outputContext ? (this.outputContext.state as any) : 'closed';
    return {
      audioTrackState: trackState,
      audioStreamType: 'STREAM_MUSIC (Android Media Voice Playback)',
      sampleRate: COMPANION_CONFIG.outputSampleRate,
      channelCount: COMPANION_CONFIG.channelCount || 1,
      pcmEncoding: COMPANION_CONFIG.pcmEncoding || '16-bit Linear PCM (Little-Endian)',
      bufferSize: COMPANION_CONFIG.bufferSize,
      applicationGain: this.applicationGain,
      systemStreamVolume: 'Android Host Media Stream (Active)',
      systemStreamMaxVolume: 'Hardware Max Capable (Limiter at -1.0 dBFS)',
      peakOutputDb: this.lastOutputDb,
    };
  }

  /**
   * Set whether microphone audio is actively being streamed to Gemini Live
   */
  public setGeminiStreamingActive(active: boolean): void {
    this.isGeminiStreamingActive = active;
  }

  public isStreamingToGemini(): boolean {
    return this.isGeminiStreamingActive;
  }

  /**
   * Explicitly stop microphone capture and release all recording/audio resources
   */
  public stopMicrophone(): void {
    console.log('[MYRAA AUDIO] Microphone stop requested');
    if (this.micLifecycle === 'OFF' && !this.micStream && !this.isRecording) {
      return;
    }
    this.micLifecycle = 'STOPPING';
    this.isRecording = false;
    this.isGeminiStreamingActive = false;
    this.micStatus = 'INACTIVE';

    if (this.micStream) {
      try {
        this.micStream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {
        console.warn('[AudioEngine] Error stopping mic track:', e);
      }
      this.micStream = null;
    }

    if (this.micProcessor) {
      try {
        this.micProcessor.onaudioprocess = null;
        this.micProcessor.disconnect();
      } catch (e) {
        // ignore
      }
      this.micProcessor = null;
    }

    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {
        // ignore
      }
      this.micSource = null;
    }

    if (this.micAnalyser) {
      try {
        this.micAnalyser.disconnect();
      } catch (e) {
        // ignore
      }
      this.micAnalyser = null;
    }

    if (this.silentSinkNode) {
      try {
        this.silentSinkNode.disconnect();
      } catch (e) {
        // ignore
      }
      this.silentSinkNode = null;
    }

    // Safely suspend input context instead of closing to avoid repeated AudioContext recreations
    if (this.inputContext && this.inputContext.state === 'running') {
      try {
        this.inputContext.suspend().catch(() => {});
      } catch (e) {
        // ignore
      }
    }

    this.micLifecycle = 'OFF';
    console.log('[MYRAA AUDIO] Microphone stopped');
  }

  /**
   * Start microphone capture with single MediaStream lifecycle and feedback prevention
   */
  public async startMicrophone(options?: { isBackgroundStandby?: boolean }): Promise<boolean> {
    console.log('[MYRAA AUDIO] Microphone start requested');

    if (this.micLifecycle === 'STARTING') {
      console.warn('[MYRAA AUDIO WARNING] Duplicate microphone initialization prevented (microphone STARTING)');
      return this.isMicrophoneActive();
    }

    if (this.micLifecycle === 'ON' && this.isMicrophoneActive()) {
      console.log('[MYRAA AUDIO] Microphone already active');
      console.warn('[MYRAA AUDIO WARNING] Duplicate microphone initialization prevented');
      return true;
    }

    this.micLifecycle = 'STARTING';

    const isBackground = options?.isBackgroundStandby ?? false;

    // Check mediaDevices availability
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.micStatus = 'ERROR';
      this.micLifecycle = 'OFF';
      const msg = 'Audio recording is not supported in this browser environment.';
      if (!isBackground) {
        this.callbacks.onError(msg);
      }
      return false;
    }

    try {
      // Step 3: Reuse active MediaStream if already valid, otherwise create ONE
      const isStreamAlive =
        this.micStream !== null &&
        this.micStream.active &&
        this.micStream.getAudioTracks().some((t) => t.readyState === 'live' && t.enabled);

      if (!isStreamAlive) {
        if (this.micStream) {
          try {
            this.micStream.getTracks().forEach((t) => t.stop());
          } catch (e) {}
          this.micStream = null;
        }
        console.log('[MYRAA AUDIO] Creating MediaStream');
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: COMPANION_CONFIG.inputSampleRate,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        console.log('[MYRAA AUDIO] MediaStream created');
      } else {
        console.log('[MYRAA AUDIO] Microphone already active (reusing stream)');
      }

      // Step 6: Persistent AudioContext management - never destroy/recreate unnecessarily
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.inputContext || this.inputContext.state === 'closed') {
        this.inputContext = new AudioCtx({ sampleRate: COMPANION_CONFIG.inputSampleRate });
      }
      if (this.inputContext.state === 'suspended') {
        await this.inputContext.resume();
      }

      // Output context (24kHz for high-fidelity speech synthesis output)
      if (!this.outputContext || this.outputContext.state === 'closed') {
        this.outputContext = new AudioCtx({
          sampleRate: COMPANION_CONFIG.outputSampleRate,
          latencyHint: 'interactive',
        });
      }
      if (this.outputContext.state === 'suspended') {
        await this.outputContext.resume();
      }

      // Cleanly disconnect any previous input node connections
      if (this.micProcessor) {
        try {
          this.micProcessor.onaudioprocess = null;
          this.micProcessor.disconnect();
        } catch (e) {}
        this.micProcessor = null;
      }
      if (this.micSource) {
        try {
          this.micSource.disconnect();
        } catch (e) {}
        this.micSource = null;
      }
      if (this.micAnalyser) {
        try {
          this.micAnalyser.disconnect();
        } catch (e) {}
        this.micAnalyser = null;
      }
      if (this.silentSinkNode) {
        try {
          this.silentSinkNode.disconnect();
        } catch (e) {}
        this.silentSinkNode = null;
      }

      // Input processing pipeline
      this.micSource = this.inputContext.createMediaStreamSource(this.micStream);
      this.micAnalyser = this.inputContext.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micAnalyser.smoothingTimeConstant = 0.3;

      // ScriptProcessor for raw PCM chunks
      this.micProcessor = this.inputContext.createScriptProcessor(
        COMPANION_CONFIG.bufferSize,
        1,
        1
      );
      this.micProcessor.onaudioprocess = (e) => {
        // Step 7: Feedback prevention: zero out all output buffers so mic never bleeds into speakers
        for (let c = 0; c < e.outputBuffer.numberOfChannels; c++) {
          e.outputBuffer.getChannelData(c).fill(0);
        }

        if (!this.isRecording || this.isMuted) return;
        const ctxSampleRate = this.inputContext?.sampleRate || 16000;
        const numChannels = e.inputBuffer.numberOfChannels;
        const bufferLength = e.inputBuffer.length;

        // Step 5: Convert stereo to mono if needed: mono = (left + right) / 2
        let monoInput: Float32Array;
        if (numChannels === 1) {
          monoInput = e.inputBuffer.getChannelData(0);
        } else {
          monoInput = new Float32Array(bufferLength);
          const ch0 = e.inputBuffer.getChannelData(0);
          const ch1 = e.inputBuffer.getChannelData(1);
          for (let i = 0; i < bufferLength; i++) {
            monoInput[i] = (ch0[i] + ch1[i]) * 0.5;
          }
        }

        // Step 2, 3, 6: Compute real audio statistics directly on raw audio buffer
        let sumSq = 0;
        let absSum = 0;
        let pcmMin = Infinity;
        let pcmMax = -Infinity;
        let pcmSum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const s = monoInput[i];
          sumSq += s * s;
          absSum += Math.abs(s);
          if (s < pcmMin) pcmMin = s;
          if (s > pcmMax) pcmMax = s;
          pcmSum += s;
        }
        const rms = Math.sqrt(sumSq / bufferLength);
        const rmsDb = rms > 1e-6 ? 20 * Math.log10(rms) : -100;
        const peak = Math.max(Math.abs(pcmMin === Infinity ? 0 : pcmMin), Math.abs(pcmMax === -Infinity ? 0 : pcmMax));
        const avg = absSum / bufferLength;
        const mean = pcmSum / bufferLength;

        // Step 4: Verify Sample Rate and Resample to 16000 Hz if needed
        let final16kSamples: Float32Array;
        if (ctxSampleRate === 16000) {
          final16kSamples = monoInput;
        } else {
          const ratio = ctxSampleRate / 16000;
          const outLength = Math.max(1, Math.round(bufferLength / ratio));
          final16kSamples = new Float32Array(outLength);
          for (let i = 0; i < outLength; i++) {
            const srcIdx = i * ratio;
            const i0 = Math.floor(srcIdx);
            const i1 = Math.min(bufferLength - 1, i0 + 1);
            const frac = srcIdx - i0;
            final16kSamples[i] = monoInput[i0] * (1 - frac) + monoInput[i1] * frac;
          }
        }

        this.liveAudioDiagnostics = {
          audioContextSampleRate: ctxSampleRate,
          micSampleRate: ctxSampleRate,
          channelCount: numChannels,
          isMono: numChannels === 1,
          bufferSize: bufferLength,
          rawRms: Math.round(rms * 1000) / 1000,
          rawRmsDb: Math.round(rmsDb * 10) / 10,
          peakAmplitude: Math.round(peak * 1000) / 1000,
          averageAmplitude: Math.round(avg * 1000) / 1000,
          inputSampleRate: ctxSampleRate,
          targetSampleRate: 16000,
          resampledSampleRate: 16000,
          numSamples: final16kSamples.length,
          pcmRange: '[-1.0, 1.0] Float32',
          minPcm: Math.round((pcmMin === Infinity ? 0 : pcmMin) * 1000) / 1000,
          maxPcm: Math.round((pcmMax === -Infinity ? 0 : pcmMax) * 1000) / 1000,
          meanPcm: Math.round(mean * 10000) / 10000,
        };

        this.lastAudioFrameTime = Date.now();
        this.totalFramesProcessed++;

        // 1. Send resampled 16kHz mono Float32 samples to Neural Layer (VAD / Wake-Word)
        if (this.callbacks.onRawSamples) {
          this.callbacks.onRawSamples(final16kSamples, this.liveAudioDiagnostics);
        }

        // 2. Only encode and send to Gemini Live if actively in conversation session
        if (this.isGeminiStreamingActive) {
          const pcm16 = this.floatTo16BitPCM(final16kSamples);
          const base64 = this.arrayBufferToBase64(pcm16.buffer);
          this.callbacks.onAudioChunk(base64);
        }
      };

      // Output pipeline: Gain -> LowCut -> Warmth -> Clarity -> Air -> Peak Safety Limiter -> Analyser -> Destination
      if (!this.outputGainNode) {
        this.outputAnalyser = this.outputContext.createAnalyser();
        this.outputAnalyser.fftSize = 256;
        this.outputAnalyser.smoothingTimeConstant = 0.3;
        this.outputGainNode = this.outputContext.createGain();
        this.outputGainNode.gain.value = this.applicationGain;

        // 1. Gentle highpass (75Hz) to eliminate DC rumble without touching speech fundamentals
        this.lowCutFilter = this.outputContext.createBiquadFilter();
        this.lowCutFilter.type = 'highpass';
        this.lowCutFilter.frequency.value = 75;
        this.lowCutFilter.Q.value = 0.707;

        // 2. Warmth presence (240Hz peaking, +1.2dB) for natural vocal body
        this.warmthFilter = this.outputContext.createBiquadFilter();
        this.warmthFilter.type = 'peaking';
        this.warmthFilter.frequency.value = 240;
        this.warmthFilter.Q.value = 0.9;
        this.warmthFilter.gain.value = 1.2;

        // 3. Conversational clarity & presence (3.2kHz peaking, +2.0dB) for high speech intelligibility
        this.clarityFilter = this.outputContext.createBiquadFilter();
        this.clarityFilter.type = 'peaking';
        this.clarityFilter.frequency.value = 3200;
        this.clarityFilter.Q.value = 1.0;
        this.clarityFilter.gain.value = 2.0;

        // 4. Air & silky finish (8.5kHz high-shelf, +1.0dB)
        this.airFilter = this.outputContext.createBiquadFilter();
        this.airFilter.type = 'highshelf';
        this.airFilter.frequency.value = 8500;
        this.airFilter.gain.value = 1.0;

        // 5. Transparent Peak Safety Limiter (Threshold -1.0 dBFS, Ratio 20:1)
        this.vocalLimiter = this.outputContext.createDynamicsCompressor();
        this.vocalLimiter.threshold.value = -1.0;
        this.vocalLimiter.knee.value = 1.0;
        this.vocalLimiter.ratio.value = 20.0;
        this.vocalLimiter.attack.value = 0.001;
        this.vocalLimiter.release.value = 0.05;

        // Connect pipeline cleanly
        this.outputGainNode.connect(this.lowCutFilter);
        this.lowCutFilter.connect(this.warmthFilter);
        this.warmthFilter.connect(this.clarityFilter);
        this.clarityFilter.connect(this.airFilter);
        this.airFilter.connect(this.vocalLimiter);
        this.vocalLimiter.connect(this.outputAnalyser);
        this.outputAnalyser.connect(this.outputContext.destination);
      }

      // Connect input nodes: micSource -> micAnalyser -> micProcessor -> silentSinkNode -> destination
      // Step 7: Feedback prevention: silentSinkNode with gain=0 prevents any audio from reaching speakers
      this.silentSinkNode = this.inputContext.createGain();
      this.silentSinkNode.gain.value = 0;

      this.micSource.connect(this.micAnalyser);
      this.micAnalyser.connect(this.micProcessor);
      this.micProcessor.connect(this.silentSinkNode);
      this.silentSinkNode.connect(this.inputContext.destination);

      this.isRecording = true;
      this.micStatus = 'ACTIVE';
      this.micLifecycle = 'ON';
      this.startMetricsLoop();
      console.log('[MYRAA AUDIO] Microphone active');
      return true;
    } catch (err: any) {
      this.micLifecycle = 'OFF';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission denied')) {
        this.micStatus = 'PERMISSION_DENIED';
        if (!isBackground) {
          const errorMsg = 'Microphone permission was denied. Please allow microphone access in your browser or click to enable.';
          console.warn('[AudioEngine] Microphone access denied by user or browser policy.');
          this.callbacks.onError(errorMsg);
        } else {
          console.info('[AudioEngine] Microphone waiting for user interaction/permission.');
        }
      } else if (err.name === 'NotFoundError') {
        this.micStatus = 'ERROR';
        if (!isBackground) {
          const errorMsg = 'No microphone device found on your system.';
          this.callbacks.onError(errorMsg);
        }
      } else {
        this.micStatus = 'ERROR';
        if (!isBackground) {
          this.callbacks.onError(err.message || 'Could not access microphone.');
        }
      }
      return false;
    }
  }

  /**
   * Convert float audio samples (-1.0 to 1.0) to 16-bit PCM (Int16Array)
   */
  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  /**
   * Convert 16-bit PCM ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Decode Base64 16-bit PCM chunk to Float32 array safely and with zero attenuation
   */
  private base64ToFloat32(base64: string): Float32Array {
    const binary = window.atob(base64);
    const len = binary.length;
    const numSamples = Math.floor(len / 2);
    const float32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const b1 = binary.charCodeAt(i * 2);
      const b2 = binary.charCodeAt(i * 2 + 1);
      // Little-endian signed 16-bit integer reconstruction
      let int16 = (b2 << 8) | b1;
      if (int16 >= 0x8000) {
        int16 -= 0x10000;
      }
      // Exact unattenuated float conversion
      float32[i] = int16 / 32768.0;
    }
    return float32;
  }

  /**
   * Schedule PCM audio chunk playback at 24kHz seamlessly
   */
  public async playAudioChunk(base64Pcm: string): Promise<void> {
    if (!this.outputContext || this.outputContext.state === 'closed') {
      console.warn('[MYRAA AUDIO] Output AudioContext is unavailable');
      return;
    }

    try {
      // Android WebView may suspend AudioContext.
      // Wait until it is actually running before playback.
      if (this.outputContext.state !== 'running') {
        console.log(
          '[MYRAA AUDIO] Resuming output context. Current state:',
          this.outputContext.state
        );

        await this.outputContext.resume();

        console.log(
          '[MYRAA AUDIO] Output context after resume:',
          this.outputContext.state
        );
      }

      if (this.outputContext.state !== 'running') {
        console.warn(
          '[MYRAA AUDIO] Output context did not enter running state'
        );
        return;
      }

      if (!this.outputGainNode) {
        console.error('[MYRAA AUDIO] Output gain node is not initialized');
        return;
      }

      console.log(
        '[MYRAA AUDIO] Received PCM chunk. Base64 length:',
        base64Pcm.length
      );

      const floatData = this.base64ToFloat32(base64Pcm);

      if (floatData.length === 0) {
        console.warn('[MYRAA AUDIO] Empty PCM audio chunk');
        return;
      }

      console.log(
        '[MYRAA AUDIO] Decoded PCM samples:',
        floatData.length,
        'Sample rate:',
        COMPANION_CONFIG.outputSampleRate
      );

      const audioBuffer = this.outputContext.createBuffer(
        1,
        floatData.length,
        COMPANION_CONFIG.outputSampleRate
      );

      audioBuffer.getChannelData(0).set(floatData);

      const source = this.outputContext.createBufferSource();
      source.buffer = audioBuffer;

      source.connect(this.outputGainNode);

      const now = this.outputContext.currentTime;

      if (this.nextStartTime < now) {
        this.nextStartTime = now + 0.012;
      }

      source.start(this.nextStartTime);

      console.log(
        '[MYRAA AUDIO] Playback started. Duration:',
        audioBuffer.duration
      );

      this.nextStartTime += audioBuffer.duration;

      this.activeSources.push(source);

      if (!this.isPlayingAudio) {
        this.isPlayingAudio = true;
        this.callbacks.onPlaybackStateChange(true);
      }

      source.onended = () => {
        const index = this.activeSources.indexOf(source);

        if (index > -1) {
          this.activeSources.splice(index, 1);
        }

        if (this.activeSources.length === 0) {
          this.isPlayingAudio = false;
          this.callbacks.onPlaybackStateChange(false);
        }
      };

    } catch (err) {
      console.error(
        '[MYRAA AUDIO] Error playing audio chunk:',
        err
      );
    }
  }

  /**
   * Barge-in: Discard all buffered playback immediately
   */
  public interruptPlayback(): void {
    if (this.activeSources.length === 0 && !this.isPlayingAudio) return;
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // already stopped
      }
    }
    this.activeSources = [];
    if (this.outputContext) {
      this.nextStartTime = this.outputContext.currentTime;
    } else {
      this.nextStartTime = 0;
    }
    this.isPlayingAudio = false;
    this.callbacks.onPlaybackStateChange(false);
  }

  /**
   * Volume and frequency analysis loop for UI visualization
   */
  private startMetricsLoop(): void {
    const updateMetrics = () => {
      if (!this.isRecording) return;

      // Calculate mic input levels
      let micLevel = 0;
      let micDb = -100;
      if (this.micAnalyser && !this.isMuted) {
        const inputData = new Uint8Array(this.micAnalyser.frequencyBinCount);
        this.micAnalyser.getByteFrequencyData(inputData);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i];
        }
        micLevel = Math.min(1, (sum / inputData.length) / 128);
        micDb = micLevel > 0.01 ? 20 * Math.log10(micLevel) : -90;
      }
      this.callbacks.onInputVolume(micLevel, micDb);

      // Calculate output playback levels
      let outLevel = 0;
      let outDb = -100;
      if (this.outputAnalyser && this.isPlayingAudio) {
        const outData = new Uint8Array(this.outputAnalyser.frequencyBinCount);
        this.outputAnalyser.getByteFrequencyData(outData);
        let sum = 0;
        for (let i = 0; i < outData.length; i++) {
          sum += outData[i];
        }
        outLevel = Math.min(1, (sum / outData.length) / 128);
        outDb = outLevel > 0.01 ? 20 * Math.log10(outLevel) : -90;
      }
      this.lastOutputDb = outDb;
      this.callbacks.onOutputVolume(outLevel, outDb);

      this.animationFrameId = requestAnimationFrame(updateMetrics);
    };
    this.animationFrameId = requestAnimationFrame(updateMetrics);
  }

  public getMicFrequencyData(array: Uint8Array): void {
    if (this.micAnalyser) {
      this.micAnalyser.getByteFrequencyData(array);
    }
  }

  public getOutputFrequencyData(array: Uint8Array): void {
    if (this.outputAnalyser) {
      this.outputAnalyser.getByteFrequencyData(array);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public isMicrophoneMuted(): boolean {
    return this.isMuted;
  }

  public isPlaying(): boolean {
    return this.isPlayingAudio;
  }

  public getBufferQueueLength(): number {
    return this.activeSources.length;
  }

  /**
   * Complete teardown and resource release
   */
  public cleanup(): void {
    this.isRecording = false;
    this.isPlayingAudio = false;
    this.isGeminiStreamingActive = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.interruptPlayback();
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor.onaudioprocess = null;
      this.micProcessor = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micAnalyser) {
      this.micAnalyser.disconnect();
      this.micAnalyser = null;
    }
    if (this.outputGainNode) {
      this.outputGainNode.disconnect();
      this.outputGainNode = null;
    }
    if (this.lowCutFilter) {
      this.lowCutFilter.disconnect();
      this.lowCutFilter = null;
    }
    if (this.warmthFilter) {
      this.warmthFilter.disconnect();
      this.warmthFilter = null;
    }
    if (this.clarityFilter) {
      this.clarityFilter.disconnect();
      this.clarityFilter = null;
    }
    if (this.airFilter) {
      this.airFilter.disconnect();
      this.airFilter = null;
    }
    if (this.vocalLimiter) {
      this.vocalLimiter.disconnect();
      this.vocalLimiter = null;
    }
    if (this.outputAnalyser) {
      this.outputAnalyser.disconnect();
      this.outputAnalyser = null;
    }
    if (this.inputContext && this.inputContext.state !== 'closed') {
      this.inputContext.close();
      this.inputContext = null;
    }
    if (this.outputContext && this.outputContext.state !== 'closed') {
      this.outputContext.close();
      this.outputContext = null;
    }
  }
}
