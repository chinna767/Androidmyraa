/**
 * MyraaAudioStateController.ts
 * Master Audio & Neural State Controller coordinating:
 * MICROPHONE
 *       ↓
 * Audio Capture (AudioEngine)
 *       ↓
 * Audio Preprocessing (AudioPreprocessor)
 *       ↓
 * TensorFlow Lite VAD (VoiceActivityDetector)
 *       ↓
 * TensorFlow Lite Wake-Word Detector (WakeWordEngine)
 *       ↓
 * MYRAA State Controller (MyraaAudioStateController)
 *       ↓
 * Gemini Live (GeminiLiveService)
 *       ↓
 * Existing MYRAA Voice Output (AudioEngine)
 */

import { CompanionState, NeuralAudioDiagnostics, DebugLog, TranscriptItem } from '../types';
import { AudioEngine } from './audioEngine';
import { VoiceActivityDetector } from './VoiceActivityDetector';
import { WakeWordEngine } from './WakeWordEngine';
import { GeminiLiveService } from './GeminiLiveService';
import { toolManager } from './ToolManager';
import { systemControlManager } from './SystemControlManager';
import { callManager } from './call/CallManager';
import { callStateManager } from './call/CallStateManager';

export interface StateControllerCallbacks {
  onStateChange: (state: CompanionState) => void;
  onTranscriptUpdate: (item: TranscriptItem) => void;
  onDebugLog: (log: Omit<DebugLog, 'id' | 'timestamp'>) => void;
  onMetricsUpdate: (metrics: any) => void;
  onDiagnosticsUpdate: (diagnostics: NeuralAudioDiagnostics) => void;
  onError: (error: string) => void;
  onMemorySaved?: (record: any) => void;
}

export class MyraaAudioStateController {
  private state: CompanionState = 'STANDBY';
  private callbacks: StateControllerCallbacks;

  // Subsystems
  private audioEngine: AudioEngine | null = null;
  private vadEngine: VoiceActivityDetector | null = null;
  private wakeWordEngine: WakeWordEngine | null = null;
  private geminiLive: GeminiLiveService | null = null;

  // Diagnostics & Metrics
  private diagnostics: NeuralAudioDiagnostics = {
    wakeWordState: 'STANDBY',
    wakeDetectorStatus: 'UNAVAILABLE',
    micStatus: 'INACTIVE',
    modelStatus: 'READY',
    modelName: 'Myraa-MicroWakeWord-Conv2D-v1',
    isMyraaClassTrained: true,
    wakeWordConfidence: 0,
    wakeWordThreshold: 0.75,
    vadState: 'STANDBY',
    vadProbability: 0,
    vadThreshold: 0.58,
    tensorFlowStatus: 'INITIALIZING',
    tensorFlowBackend: 'wasm',
    geminiStatus: 'DISCONNECTED',
    audioState: 'STANDBY',
    inferenceLatencyMs: 0,
    interruptionCount: 0,
    framesReceivedInStandby: 0,
  };

  private interruptionCount: number = 0;
  private isMuted: boolean = false;
  private micEnabled: boolean = true;
  private diagnosticsInterval: NodeJS.Timeout | null = null;

  constructor(callbacks: StateControllerCallbacks) {
    this.callbacks = callbacks;
    this.initEngines();
    this.setupBrowserLifecycleListeners();
    this.startDiagnosticsPolling();
  }

  /**
   * Listen for browser backgrounding/tab suspension
   */
  private setupBrowserLifecycleListeners(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.diagnostics.isBrowserThrottled = true;
        this.diagnostics.browserLimitation =
          'Browser environment limitation: continuous background wake-word detection cannot be guaranteed.';
        this.log(
          'warn',
          'SYSTEM',
          'Page inactive: Browser backgrounding may suspend continuous microphone capture.'
        );
      } else {
        this.diagnostics.isBrowserThrottled = false;
        this.diagnostics.browserLimitation = undefined;
        if (this.state === 'STANDBY' && this.audioEngine && this.micEnabled) {
          this.audioEngine.resumeInputContext().then((active) => {
            if (active && this.micEnabled && this.wakeWordEngine && !this.wakeWordEngine.isCurrentlyListening()) {
              this.wakeWordEngine.startListening(() => this.handleWakeWordTriggered(0.96));
            }
          });
        }
      }
      this.syncDiagnostics();
    });
  }

  private startDiagnosticsPolling(): void {
    if (this.diagnosticsInterval) clearInterval(this.diagnosticsInterval);
    this.diagnosticsInterval = setInterval(() => {
      this.syncDiagnostics();
    }, 250);
  }

  private syncDiagnostics(): void {
    const isMicLive = this.audioEngine?.isMicrophoneActive() ?? false;
    const micStatus = this.audioEngine?.getMicStatus() ?? 'INACTIVE';
    const isWakeListening = this.wakeWordEngine?.isCurrentlyListening() ?? false;

    this.diagnostics.micStatus = this.micEnabled ? micStatus : 'INACTIVE';
    this.diagnostics.modelStatus = this.wakeWordEngine?.getModelStatus() ?? 'READY';
    this.diagnostics.modelName = this.wakeWordEngine?.getModelMetadata()?.modelName ?? 'Myraa-MicroWakeWord-v1';
    this.diagnostics.isMyraaClassTrained = this.wakeWordEngine?.isModelTrained() ?? true;
    this.diagnostics.modelLimitationNotice = this.wakeWordEngine?.getModelLimitationNotice();
    this.diagnostics.lastInferenceTimestamp = this.wakeWordEngine?.getLastInferenceTimestamp();
    this.diagnostics.wakeWordConfidence = this.wakeWordEngine?.getLatestConfidence() ?? 0;
    this.diagnostics.framesReceivedInStandby = this.wakeWordEngine?.getTotalFramesProcessed() ?? 0;
    this.diagnostics.wakeWordTelemetry = this.wakeWordEngine?.getWakeWordTelemetry();

    if (!this.micEnabled) {
      this.diagnostics.wakeDetectorStatus = 'STOPPED';
      this.diagnostics.wakeWordState = 'OFF';
      this.diagnostics.micStatus = 'INACTIVE';
    } else if (this.state === 'STANDBY') {
      if (typeof document !== 'undefined' && document.hidden) {
        this.diagnostics.wakeDetectorStatus = 'SUSPENDED';
      } else if (isMicLive && isWakeListening) {
        this.diagnostics.wakeDetectorStatus = 'RUNNING';
        this.diagnostics.wakeWordState = 'READY';
      } else if (!isMicLive) {
        this.diagnostics.wakeDetectorStatus = 'UNAVAILABLE';
        this.diagnostics.wakeWordState = 'STANDBY';
      } else {
        this.diagnostics.wakeDetectorStatus = 'STOPPED';
      }
    } else {
      this.diagnostics.wakeDetectorStatus = 'STOPPED';
      this.diagnostics.wakeWordState = 'OFF';
    }

    this.updateDiagnostics();
  }

  /**
   * Initializes on-device Neural Audio subsystems
   */
  private initEngines(): void {
    // Connect ToolManager and SystemControlManager
    toolManager.setLogCallback((log) => this.callbacks.onDebugLog(log));
    systemControlManager.registerAudioEngineGainSetter((gain) => this.setOutputGain(gain));

    // 1. Initialize Neural Voice Activity Detector (VAD)
    this.vadEngine = new VoiceActivityDetector(
      {
        onSpeechStart: () => {
          if (this.state === 'LISTENING') {
            this.setState('USER_SPEAKING');
            this.log('info', 'VAD', 'Neural VAD: Chinna started speaking');
          }
        },
        onSpeechEnd: (durationMs) => {
          if (this.state === 'USER_SPEAKING') {
            this.setState('LISTENING');
            this.log('info', 'VAD', `Neural VAD: Chinna stopped speaking (Turn duration: ${durationMs}ms)`);
          }
        },
        onBargeInDetected: () => {
          this.handleBargeInInterruption();
        },
        onSpeechProbability: (prob, isSpeech, latencyMs) => {
          this.diagnostics.vadProbability = Math.round(prob * 100) / 100;
          this.diagnostics.vadState = this.state === 'STANDBY' ? 'STANDBY' : isSpeech ? 'SPEECH' : 'SILENCE';
          this.diagnostics.inferenceLatencyMs = latencyMs;
          this.updateDiagnostics();
        },
        onError: (err) => {
          this.log('error', 'TFLITE', `Neural VAD Error: ${err}`);
        },
      },
      {
        speechThreshold: this.diagnostics.vadThreshold,
        sampleRate: 16000,
      }
    );

    // 2. Initialize Neural Wake-Word Detector for "Myraa"
    this.wakeWordEngine = new WakeWordEngine(
      {
        onWakeWordDetected: (confidence) => {
          this.handleWakeWordTriggered(confidence);
        },
        onConfidenceUpdate: (confidence, latencyMs) => {
          this.diagnostics.wakeWordConfidence = Math.round(confidence * 100) / 100;
          if (this.state === 'STANDBY') {
            this.diagnostics.inferenceLatencyMs = latencyMs;
          }
          this.diagnostics.wakeWordTelemetry = this.wakeWordEngine?.getWakeWordTelemetry();
          this.updateDiagnostics();
        },
        onListeningStateChange: (isListening) => {
          this.diagnostics.wakeWordState = isListening ? 'READY' : 'STANDBY';
          this.updateDiagnostics();
        },
        onError: (err) => {
          this.log('error', 'TFLITE', `Neural WakeWord Error: ${err}`);
        },
      },
      {
        wakeWordThreshold: this.diagnostics.wakeWordThreshold,
        sampleRate: 16000,
      }
    );

    // Update initial TensorFlow backend status
    setTimeout(() => {
      if (this.vadEngine?.isReady() || this.wakeWordEngine?.isReady()) {
        this.diagnostics.tensorFlowStatus = 'READY';
        this.diagnostics.tensorFlowBackend = this.vadEngine?.getBackendName() || 'cpu';
        this.log('success', 'TFLITE', `TensorFlow on-device neural audio layer READY [${this.diagnostics.tensorFlowBackend.toUpperCase()}]`);
      } else {
        this.diagnostics.tensorFlowStatus = 'RUNNING';
      }
      this.updateDiagnostics();
    }, 600);

    // 3. Initialize Gemini Live Service proxy
    this.geminiLive = new GeminiLiveService({
      onStateChange: (companionState) => {
        if (companionState === 'MYRAA_SPEAKING') {
          this.vadEngine?.setMyraaSpeakingState(true);
          this.setState('MYRAA_SPEAKING');
        } else if (companionState === 'LISTENING') {
          this.vadEngine?.setMyraaSpeakingState(false);
          this.setState('LISTENING');
        } else if (companionState === 'CONNECTED') {
          this.diagnostics.geminiStatus = 'CONNECTED';
          this.setState('LISTENING');
        } else if (companionState === 'DISCONNECTED') {
          this.diagnostics.geminiStatus = 'DISCONNECTED';
          if (this.state !== 'STANDBY') {
            this.setState('STANDBY');
          }
        }
      },
      onTranscriptUpdate: (item) => {
        this.callbacks.onTranscriptUpdate(item);
      },
      onDebugLog: (log) => {
        this.callbacks.onDebugLog(log);
      },
      onMetricsUpdate: (metrics) => {
        this.callbacks.onMetricsUpdate(metrics);
      },
      onError: (err) => {
        this.callbacks.onError(err);
      },
      onMemorySaved: (record) => {
        if (this.callbacks.onMemorySaved) {
          this.callbacks.onMemorySaved(record);
        }
      },
      onStopRequested: () => {
        this.enterStandby();
      },
    });

    // 4. Initialize Unified Phone Call Management wiring
    callManager.setLogCallback((log) => this.callbacks.onDebugLog(log));
    callManager.incoming.setNotificationCallback((announcement, callerInfo) => {
      // 1. If MYRAA is currently talking, interrupt her speech immediately
      if (this.geminiLive) {
        this.geminiLive.interruptPlayback();
      }

      // 2. Put user and companion into responsive state
      if (this.state === 'STANDBY') {
        this.handleWakeWordTriggered(1.0);
      }

      // 3. Announce the incoming caller
      this.callbacks.onTranscriptUpdate({
        id: `call-incoming-${Date.now()}`,
        speaker: 'myraa',
        text: announcement,
        timestamp: new Date(),
        isStreaming: false,
      });

      // 4. Speak announcement in MYRAA's melodic companion voice
      if (this.geminiLive) {
        this.geminiLive.synthesizeAndPlayVoice(announcement);
      }
    });

    callStateManager.subscribe((newCallState) => {
      if (newCallState === 'IN_CALL') {
        // Suppress/interrupt assistant audio during phone conversation
        if (this.geminiLive) {
          this.geminiLive.interruptPlayback();
        }
      }
    });
  }

  public getState(): CompanionState {
    return this.state;
  }

  public getDiagnostics(): NeuralAudioDiagnostics {
    return this.diagnostics;
  }

  private setState(newState: CompanionState): void {
    if (this.state === newState) return;
    this.state = newState;
    if (newState === 'STANDBY') {
      this.diagnostics.geminiStatus = 'DISCONNECTED';
      this.diagnostics.audioState = 'STANDBY';
      this.diagnostics.vadState = 'STANDBY';
    } else if (newState === 'CONNECTING') {
      this.diagnostics.geminiStatus = 'CONNECTING';
      this.diagnostics.audioState = 'ACTIVE';
    } else if (newState === 'INTERRUPTED') {
      this.diagnostics.audioState = 'INTERRUPTED';
    } else {
      this.diagnostics.audioState = 'ACTIVE';
      this.diagnostics.geminiStatus = 'CONNECTED';
    }
    this.callbacks.onStateChange(newState);
    this.updateDiagnostics();
  }

  private updateDiagnostics(): void {
    this.callbacks.onDiagnosticsUpdate({ ...this.diagnostics });
  }

  private log(
    level: 'info' | 'warn' | 'error' | 'success',
    source: 'SYSTEM' | 'MIC' | 'AUDIO_OUT' | 'WEBSOCKET' | 'GEMINI' | 'MEMORY' | 'WAKEWORD' | 'EMOTION' | 'TFLITE' | 'VAD',
    message: string
  ): void {
    this.callbacks.onDebugLog({ level, source, message });
  }

  /**
   * Initializes the shared AudioEngine pipeline
   */
  private async initAudioEngine(): Promise<void> {
    if (this.audioEngine) return;
    this.audioEngine = new AudioEngine({
      onAudioChunk: (base64) => {
        if (this.geminiLive && this.state !== 'STANDBY') {
          this.geminiLive.sendAudioChunk(base64);
        }
      },
      onRawSamples: (samples, audioTelemetry) => {
        this.handleRawMicrophoneSamples(samples, audioTelemetry);
      },
      onInputVolume: (level, db) => {
        this.callbacks.onMetricsUpdate({
          micLevel: level,
          inputDb: db,
          outputLevel: 0,
          outputDb: -100,
          chunksReceived: 0,
          chunksSent: 0,
          latencyMs: 0,
          audioTrackDiagnostics: this.audioEngine ? this.audioEngine.getAudioTrackDiagnostics() : undefined,
        });
      },
      onOutputVolume: () => {},
      onPlaybackStateChange: (isPlaying) => {
        this.vadEngine?.setMyraaSpeakingState(isPlaying);
      },
      onError: (err) => {
        this.log('warn', 'MIC', err);
        if (this.state !== 'STANDBY') {
          this.callbacks.onError(err);
        }
      },
    });
  }

  /**
   * Check if master microphone is enabled
   */
  public isMicrophoneEnabled(): boolean {
    return this.micEnabled;
  }

  /**
   * Set Master Microphone Listening State (ON / OFF)
   * ON: Starts audio capture & wake-word detection pipeline (say "Myraa" to wake).
   * OFF: Cleanly stops audio capture, releases microphone stream/tracks, halts VAD and wake-word listeners.
   */
  public async setMicrophoneEnabled(enabled: boolean): Promise<boolean> {
    if (!enabled) {
      this.micEnabled = false;
      // 1. Halt wake word engine
      this.wakeWordEngine?.stopListening();
      // 2. Halt VAD
      this.vadEngine?.setLowPowerMode(true);
      this.vadEngine?.setMyraaSpeakingState(false);
      // 3. Stop audio capture and release media tracks completely
      if (this.audioEngine) {
        this.audioEngine.stopMicrophone();
      }
      // 4. Update diagnostics to reflect OFF
      this.diagnostics.micStatus = 'INACTIVE';
      this.diagnostics.wakeDetectorStatus = 'STOPPED';
      this.diagnostics.wakeWordState = 'OFF';
      this.log('info', 'MIC', 'Microphone turned OFF. Microphone capture released and wake-word detector stopped.');
      this.syncDiagnostics();
      return false;
    } else {
      this.micEnabled = true;
      await this.initAudioEngine();
      let started = false;
      if (this.audioEngine) {
        started = await this.audioEngine.startMicrophone({ isBackgroundStandby: false });
      }
      if (started && this.audioEngine?.isMicrophoneActive()) {
        if (this.state === 'STANDBY') {
          this.wakeWordEngine?.reset();
          this.wakeWordEngine?.startListening(() => {
            this.handleWakeWordTriggered(0.96);
          });
          this.diagnostics.wakeDetectorStatus = 'RUNNING';
          this.diagnostics.wakeWordState = 'READY';
          this.diagnostics.micStatus = 'ACTIVE';
        }
        this.log('success', 'MIC', 'Microphone turned ON. Listening for "Myraa" wake word.');
        this.syncDiagnostics();
        return true;
      } else {
        this.micEnabled = false;
        this.diagnostics.micStatus = this.audioEngine?.getMicStatus() ?? 'INACTIVE';
        this.diagnostics.wakeDetectorStatus = 'UNAVAILABLE';
        this.diagnostics.wakeWordState = 'STANDBY';
        this.syncDiagnostics();
        return false;
      }
    }
  }

  /**
   * Toggle Master Microphone Listening State
   */
  public async toggleMicrophone(): Promise<boolean> {
    return this.setMicrophoneEnabled(!this.micEnabled);
  }

  /**
   * Explicitly ensures microphone capture is live and connected
   */
  public async ensureMicrophoneActive(): Promise<boolean> {
    if (!this.micEnabled) {
      return false;
    }
    await this.initAudioEngine();
    if (this.audioEngine && !this.audioEngine.isMicrophoneActive()) {
      try {
        const success = await this.audioEngine.startMicrophone({ isBackgroundStandby: false });
        if (success) {
          if (this.state === 'STANDBY' && this.wakeWordEngine) {
            this.wakeWordEngine.startListening(() => this.handleWakeWordTriggered(0.96));
          }
          this.diagnostics.micStatus = 'ACTIVE';
          this.diagnostics.wakeDetectorStatus = 'RUNNING';
          this.diagnostics.wakeWordState = 'READY';
        } else {
          this.diagnostics.micStatus = this.audioEngine.getMicStatus();
        }
      } catch (e: any) {
        this.log('info', 'MIC', 'Microphone activation requires user gesture.');
        return false;
      }
    }
    this.syncDiagnostics();
    return this.audioEngine?.isMicrophoneActive() ?? false;
  }

  /**
   * Start the system into STANDBY mode
   * - Local Neural Wake-Word ON
   * - Gemini Live OFF
   * - Zero audio sent to cloud
   */
  public async startStandby(): Promise<void> {
    this.setState('STANDBY');
    this.log('info', 'SYSTEM', 'MYRAA initialized in STANDBY.');
    await this.initAudioEngine();
    let micStarted = false;
    if (this.micEnabled) {
      try {
        if (this.audioEngine) {
          micStarted = await this.audioEngine.startMicrophone({ isBackgroundStandby: true });
          this.audioEngine.setGeminiStreamingActive(false);
        }
      } catch (e: any) {
        this.log('info', 'MIC', 'Microphone standby listening paused until user initiates conversation.');
      }
    }

    this.vadEngine?.setLowPowerMode(true);
    if (this.micEnabled && micStarted && this.audioEngine?.isMicrophoneActive()) {
      this.wakeWordEngine?.startListening(() => {
        this.handleWakeWordTriggered(0.96);
      });
      this.diagnostics.wakeDetectorStatus = 'RUNNING';
      this.diagnostics.wakeWordState = 'READY';
      this.diagnostics.micStatus = 'ACTIVE';
      this.log('info', 'WAKEWORD', 'Wake detector RUNNING. Say "Myraa" to wake.');
    } else {
      this.diagnostics.wakeDetectorStatus = 'UNAVAILABLE';
      this.diagnostics.wakeWordState = 'STANDBY';
      this.diagnostics.micStatus = this.audioEngine?.getMicStatus() ?? 'INACTIVE';
      this.log('info', 'WAKEWORD', 'Wake detector UNAVAILABLE (Microphone inactive - click orb or mic to start).');
    }
    this.diagnostics.tensorFlowStatus = 'RUNNING';
    this.syncDiagnostics();
  }

  /**
   * Route raw 16kHz audio samples through on-device neural detectors
   */
  private handleRawMicrophoneSamples(samples: Float32Array, audioTelemetry?: any): void {
    if (!this.micEnabled) return;
    if (this.state === 'STANDBY') {
      if (this.wakeWordEngine && this.wakeWordEngine.isCurrentlyListening()) {
        this.wakeWordEngine.processAudioChunk(samples, audioTelemetry);
      }
    } else {
      if (this.vadEngine) {
        this.vadEngine.processAudioFrame(samples);
      }
    }
  }

  /**
   * Called when "Myraa" wake word is confirmed by neural detector
   */
  public async handleWakeWordTriggered(confidence: number): Promise<void> {
    if (!this.micEnabled) {
      return;
    }
    this.log('success', 'WAKEWORD', `Neural Wake Word recognized: "Myraa" (Confidence: ${(confidence * 100).toFixed(1)}%)`);
    this.diagnostics.wakeWordState = 'DETECTED';
    this.diagnostics.wakeWordConfidence = confidence;
    this.updateDiagnostics();

    // 1. Ensure microphone is active
    if (!this.audioEngine?.isMicrophoneActive()) {
      const micOk = await this.ensureMicrophoneActive();
      if (!micOk) {
        this.log('warn', 'MIC', 'Microphone not ready. Please allow microphone permission.');
      }
    }

    // 2. Temporarily pause wake-word detector
    this.wakeWordEngine?.stopListening();

    // 3. Enable active VAD & microphone streaming
    this.vadEngine?.setLowPowerMode(false);
    this.setState('CONNECTING');

    // 4. Connect/Start Gemini Live session
    if (this.geminiLive) {
      try {
        if (this.audioEngine) {
          this.audioEngine.setGeminiStreamingActive(true);
        }
        await this.geminiLive.startSession(this.audioEngine || undefined);
        this.setState('LISTENING');
        this.log('success', 'SYSTEM', 'MYRAA is now ACTIVE and connected with Chinna.');
      } catch (err: any) {
        this.log('error', 'GEMINI', `Failed to start Live session: ${err.message}`);
        this.enterStandby();
      }
    }
  }

  /**
   * Immediate Zero-Latency Barge-In Interruption Handler
   */
  private handleBargeInInterruption(): void {
    if (this.state !== 'MYRAA_SPEAKING') return;
    this.interruptionCount++;
    this.diagnostics.interruptionCount = this.interruptionCount;
    this.diagnostics.lastBargeInTimestamp = new Date().toLocaleTimeString();
    this.log('info', 'VAD', 'Chinna interrupted MYRAA. Halting speech playback immediately.');

    if (this.audioEngine) {
      this.audioEngine.interruptPlayback();
    }
    if (this.geminiLive) {
      this.geminiLive.interruptPlayback();
    }

    this.setState('INTERRUPTED');
    this.vadEngine?.setMyraaSpeakingState(false);
    setTimeout(() => {
      if (this.state === 'INTERRUPTED') {
        this.setState('LISTENING');
      }
    }, 150);
  }

  /**
   * Transition cleanly to STANDBY mode
   */
  public async enterStandby(): Promise<void> {
    this.log('info', 'SYSTEM', 'Transitioning to STANDBY mode. Gemini Live session closed.');

    if (this.audioEngine) {
      this.audioEngine.interruptPlayback();
      this.audioEngine.setGeminiStreamingActive(false);
    }
    if (this.geminiLive) {
      this.geminiLive.stopSession();
    }

    this.vadEngine?.setMyraaSpeakingState(false);
    this.vadEngine?.setLowPowerMode(true);
    this.setState('STANDBY');

    if (this.micEnabled && this.audioEngine?.isMicrophoneActive()) {
      this.wakeWordEngine?.reset();
      this.wakeWordEngine?.startListening(() => {
        this.handleWakeWordTriggered(0.96);
      });
      this.diagnostics.wakeDetectorStatus = 'RUNNING';
      this.diagnostics.wakeWordState = 'READY';
      this.diagnostics.micStatus = 'ACTIVE';
      this.log('info', 'WAKEWORD', 'Wake detector RUNNING. Say "Myraa" to wake.');
    } else {
      if (!this.micEnabled && this.audioEngine) {
        this.audioEngine.stopMicrophone();
      }
      this.wakeWordEngine?.stopListening();
      this.diagnostics.wakeDetectorStatus = this.micEnabled ? 'UNAVAILABLE' : 'STOPPED';
      this.diagnostics.wakeWordState = this.micEnabled ? 'STANDBY' : 'OFF';
      this.diagnostics.micStatus = this.micEnabled ? (this.audioEngine?.getMicStatus() ?? 'INACTIVE') : 'INACTIVE';
      this.log('info', 'WAKEWORD', this.micEnabled ? 'Wake detector UNAVAILABLE (Microphone inactive).' : 'Microphone is OFF.');
    }
    this.syncDiagnostics();
  }

  /**
   * Manually trigger wake/connect
   */
  public async wakeManual(): Promise<void> {
    if (!this.micEnabled) {
      const enabled = await this.setMicrophoneEnabled(true);
      if (!enabled) return;
    }
    await this.handleWakeWordTriggered(1.0);
  }

  /**
   * Set configurable Wake-Word detection confidence threshold
   */
  public setWakeWordThreshold(threshold: number): void {
    this.diagnostics.wakeWordThreshold = threshold;
    this.wakeWordEngine?.setThreshold(threshold);
    this.updateDiagnostics();
  }

  /**
   * Set configurable VAD speech detection threshold
   */
  public setVadThreshold(threshold: number): void {
    this.diagnostics.vadThreshold = threshold;
    this.vadEngine?.setSpeechThreshold(threshold);
    this.updateDiagnostics();
  }

  public setOutputGain(gain: number): void {
    if (this.audioEngine) {
      this.audioEngine.setOutputGain(gain);
    }
    const liveAudioEngine = this.geminiLive?.getAudioEngine();
    if (liveAudioEngine) {
      liveAudioEngine.setOutputGain(gain);
    }
  }

  public getOutputGain(): number {
    return this.geminiLive?.getAudioEngine()?.getOutputGain() ?? this.audioEngine?.getOutputGain() ?? 1.0;
  }

  public toggleMute(): boolean {
    if (this.audioEngine) {
      this.isMuted = this.audioEngine.toggleMute();
      return this.isMuted;
    }
    return false;
  }

  public isMicrophoneMuted(): boolean {
    return this.isMuted;
  }

  public getGeminiLiveService(): GeminiLiveService | null {
    return this.geminiLive;
  }

  public getAudioEngine(): AudioEngine | null {
    return this.audioEngine;
  }

  /**
   * Clean up all audio and neural resources
   */
  public cleanup(): void {
    if (this.diagnosticsInterval) {
      clearInterval(this.diagnosticsInterval);
      this.diagnosticsInterval = null;
    }
    this.wakeWordEngine?.cleanup();
    this.vadEngine?.cleanup();
    this.audioEngine?.cleanup();
    this.geminiLive?.stopSession();
    this.audioEngine = null;
    this.vadEngine = null;
    this.wakeWordEngine = null;
    this.geminiLive = null;
  }
}
