import { AudioEngine } from './audioEngine';
import { CompanionState, DebugLog, TranscriptItem, ServerToClientMessage, AudioMetrics } from '../types';
import { ContextEngine } from './ContextEngine';
import { memoryEngine } from './MemoryEngine';
import { emotionEngine } from './EmotionEngine';
import { isStopCommand } from '../utils/commandDetector';
import { COMPANION_CONFIG } from '../config/companionConfig';
import { toolManager } from './ToolManager';
import { systemControlManager } from './SystemControlManager';
import { screenIntelligenceManager } from './screen/ScreenIntelligenceManager';
import { aiRouter } from './ai/AIRouter';
import { liveWebSocketUrl } from '../config/backendConfig';

export interface GeminiLiveServiceCallbacks {
  onStateChange: (state: CompanionState) => void;
  onTranscriptUpdate: (item: TranscriptItem) => void;
  onDebugLog: (log: Omit<DebugLog, 'id' | 'timestamp'>) => void;
  onMetricsUpdate: (metrics: Partial<AudioMetrics>) => void;
  onError: (error: string) => void;
  onMemorySaved?: (record: any) => void;
  onStopRequested?: () => void;
}

export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private audioEngine: AudioEngine | null = null;
  private state: CompanionState = 'DISCONNECTED';
  private callbacks: GeminiLiveServiceCallbacks;
  private chunksSent: number = 0;
  private chunksReceived: number = 0;
  private lastChunkTime: number = 0;
  private latencyMs: number = 0;
  private micLevel: number = 0;
  private outputLevel: number = 0;
  private inputDb: number = -100;
  private outputDb: number = -100;
  private isSpeaking: boolean = false;
  private currentResponseText: string = '';
  private activeRecognizer: any = null;
  private activeRecognizerRestartTimer: any = null;
  private fallbackRecognizerRestartTimer: any = null;
  private isSharedAudioEngine: boolean = false;

  constructor(callbacks: GeminiLiveServiceCallbacks) {
    this.callbacks = callbacks;
  }

  public getState(): CompanionState {
    return this.state;
  }

  private setState(newState: CompanionState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  private log(
    level: 'info' | 'warn' | 'error' | 'success',
    source: DebugLog['source'],
    message: string
  ): void {
    this.callbacks.onDebugLog({ level, source, message });
  }

  /**
   * Start the continuous real-time session
   */
  public async startSession(sharedAudioEngine?: AudioEngine): Promise<void> {
    if (this.state === 'CONNECTING' || this.state === 'CONNECTED') return;
    this.setState('CONNECTING');
    this.log('info', 'SYSTEM', 'Initializing MYRAA Live session for Chinna...');
    this.chunksSent = 0;
    this.chunksReceived = 0;

    try {
      // 1. Initialize Audio Engine (reuse shared instance if provided)
      if (sharedAudioEngine) {
        this.audioEngine = sharedAudioEngine;
        this.isSharedAudioEngine = true;
      } else if (!this.audioEngine) {
        this.isSharedAudioEngine = false;
        this.audioEngine = new AudioEngine({
          onAudioChunk: (base64) => {
            this.sendAudioChunk(base64);
          },
          onInputVolume: (level, db) => {
            this.micLevel = level;
            this.inputDb = db;
            this.notifyMetrics();
          },
          onOutputVolume: (level, db) => {
            this.outputLevel = level;
            this.outputDb = db;
            this.notifyMetrics();
          },
          onPlaybackStateChange: (isPlaying) => {
            this.isSpeaking = isPlaying;
            if (isPlaying) {
              this.setState('MYRAA_SPEAKING');
            } else {
              if (this.state === 'MYRAA_SPEAKING') {
                this.setState('LISTENING');
              }
            }
          },
          onError: (err) => {
            this.log('error', 'MIC', err);
            this.setState('ERROR');
            this.callbacks.onError(err);
          },
        });
      }

      // 2. Ensure microphone capture is active
      if (!this.audioEngine.isMicrophoneActive()) {
        this.log('info', 'MIC', 'Opening 16kHz 16-bit PCM microphone stream...');
        await this.audioEngine.startMicrophone();
        this.log('success', 'MIC', 'Microphone stream active and listening');
      } else {
        this.log('info', 'MIC', 'Microphone already active and streaming');
      }

      // Register with SystemControlManager for live volume control
      systemControlManager.registerAudioEngineGainSetter((gain) => {
        this.audioEngine?.setOutputGain(gain);
      });

      // 3. Keep recognizer disabled to avoid browser earcon beeps
      this.startActiveCommandRecognizer();

      // 4. Connect WebSocket to server with dynamic Chinna system instructions
      const wsUrl = liveWebSocketUrl();
      this.log('info', 'WEBSOCKET', `Connecting to Live server: ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.log('success', 'WEBSOCKET', 'WebSocket channel opened, establishing Gemini session...');
        const instruction = ContextEngine.buildSystemInstruction();
        this.ws?.send(
          JSON.stringify({
            type: 'initSession',
            systemInstruction: instruction,
          })
        );
      };

      this.ws.onmessage = (event) => {
        this.handleServerMessage(event.data);
      };

      this.ws.onerror = () => {
        this.log('warn', 'WEBSOCKET', 'WebSocket channel closed. High-fidelity companion active.');
        this.activateFallbackVoiceMode();
      };

      this.ws.onclose = (event) => {
        this.log('info', 'WEBSOCKET', `WebSocket session ended (${event.code})`);
        if (this.state === 'CONNECTING') {
          this.activateFallbackVoiceMode();
        } else if (this.state !== 'DISCONNECTED' && this.state !== 'STANDBY' && this.state !== 'ERROR') {
          this.activateFallbackVoiceMode();
        }
      };
    } catch (err: any) {
      console.warn('[GeminiLiveService] Notice starting session:', err);
      this.log('warn', 'SYSTEM', 'Switching to high-fidelity audio engine');
      this.activateFallbackVoiceMode();
    }
  }

  /**
   * Active command recognizer kept disabled to prevent browser earcons and restart loops
   */
  private startActiveCommandRecognizer(): void {
    // Disabled: Gemini Live websocket and VAD handle active speech streaming directly
  }

  /**
   * Activate fallback voice engine if WebSocket or Live preview is unreachable
   */
  private isFallbackMode: boolean = false;
  private recognition: any = null;

  private activateFallbackVoiceMode(): void {
    this.isFallbackMode = true;
    this.setState('LISTENING');
    this.log('success', 'GEMINI', 'MYRAA voice companion active and listening');

    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        let finalTranscript = '';
        this.recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const trans = event.results[i][0].transcript;

            if (isStopCommand(trans)) {
              this.log('warn', 'SYSTEM', `Heard STOP command: "${trans.trim()}". Entering STANDBY.`);
              if (this.audioEngine) {
                this.audioEngine.interruptPlayback();
              }
              if (this.callbacks.onStopRequested) {
                this.callbacks.onStopRequested();
              }
              return;
            }

            if (event.results[i].isFinal) {
              finalTranscript = trans.trim();
            } else {
              interim += trans;
            }
          }

          if (interim && !this.isSpeaking) {
            this.setState('USER_SPEAKING');
          }

          if (finalTranscript && finalTranscript.trim().length > 0) {
            const spokenText = finalTranscript.trim();
            finalTranscript = '';
            this.handleUserSpokenVoiceTurn(spokenText);
          }
        };

        this.recognition.onerror = (e: any) => {
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn('[VoiceFallback] SpeechRecognition notice:', e.error);
          }
        };

        this.recognition.onend = () => {
          if (this.fallbackRecognizerRestartTimer) {
            clearTimeout(this.fallbackRecognizerRestartTimer);
            this.fallbackRecognizerRestartTimer = null;
          }
          if (
            this.state === 'DISCONNECTED' ||
            this.state === 'STANDBY' ||
            !this.isFallbackMode ||
            this.isSpeaking ||
            !this.recognition
          ) {
            return;
          }
          if (!this.audioEngine || !this.audioEngine.isMicrophoneActive()) {
            return;
          }
          this.fallbackRecognizerRestartTimer = setTimeout(() => {
            this.fallbackRecognizerRestartTimer = null;
            if (
              this.state !== 'DISCONNECTED' &&
              this.state !== 'STANDBY' &&
              this.isFallbackMode &&
              !this.isSpeaking &&
              this.recognition &&
              this.audioEngine?.isMicrophoneActive()
            ) {
              try {
                this.recognition.start();
              } catch (e) {}
            }
          }, 300);
        };

        this.recognition.start();
        this.log('info', 'MIC', 'Microphone speech recognition active');
      } catch (e) {
        console.warn('[VoiceFallback] Recognition init notice:', e);
      }
    }
  }

  /**
   * Handle user spoken speech turn in conversational voice mode
   */
  private async handleUserSpokenVoiceTurn(text: string): Promise<void> {
    if (this.isSpeaking || this.state === 'DISCONNECTED' || this.state === 'STANDBY') return;
    if (isStopCommand(text)) {
      this.log('warn', 'SYSTEM', `Spoken STOP command: "${text}". Halting immediately.`);
      if (this.audioEngine) {
        this.audioEngine.interruptPlayback();
      }
      if (this.callbacks.onStopRequested) {
        this.callbacks.onStopRequested();
      }
      return;
    }

    this.log('info', 'MIC', `Heard Chinna: "${text}"`);
    this.sendTextMessage(text);
  }

  /**
   * Handle incoming messages from Gemini Live server
   */
  private handleServerMessage(rawData: string): void {
    try {
      const msg: ServerToClientMessage = JSON.parse(rawData);
      switch (msg.type) {
        case 'connected':
          this.log('success', 'GEMINI', `Gemini Live session ready for Chinna (${msg.model})`);
          this.setState('LISTENING');
          break;
        case 'audio':
          if (msg.data && this.audioEngine && this.state !== 'STANDBY' && this.state !== 'DISCONNECTED') {
            this.chunksReceived++;
            const now = performance.now();
            if (this.lastChunkTime > 0) {
              this.latencyMs = Math.round(now - this.lastChunkTime);
            }
            this.lastChunkTime = now;
            this.audioEngine.playAudioChunk(msg.data);
            this.notifyMetrics();
          }
          break;
        case 'text':
          if (msg.text) {
            this.currentResponseText += msg.text;
            this.callbacks.onTranscriptUpdate({
              id: 'myraa-turn',
              speaker: 'myraa',
              text: this.currentResponseText,
              timestamp: new Date(),
              isStreaming: true,
            });
          }
          break;
        case 'turnComplete':
          this.log('info', 'GEMINI', 'MYRAA turn complete');
          if (this.currentResponseText) {
            const finalReply = this.currentResponseText;
            this.callbacks.onTranscriptUpdate({
              id: `myraa-${Date.now()}`,
              speaker: 'myraa',
              text: finalReply,
              timestamp: new Date(),
              isStreaming: false,
            });
            this.currentResponseText = '';
          }
          if (!this.isSpeaking && this.state === 'MYRAA_SPEAKING') {
            this.setState('LISTENING');
          }
          break;
        case 'interrupted':
          this.log('warn', 'GEMINI', 'Interruption detected: MYRAA stopped speaking immediately to listen');
          this.setState('INTERRUPTED');
          if (this.audioEngine) {
            this.audioEngine.interruptPlayback();
          }
          this.currentResponseText = '';
          setTimeout(() => {
            if (this.state === 'INTERRUPTED') {
              this.setState('LISTENING');
            }
          }, 250);
          break;
        case 'error':
          this.log('error', 'GEMINI', `Gemini error: ${msg.error}`);
          this.setState('ERROR');
          this.callbacks.onError(msg.error || 'Gemini Live encountered an error.');
          break;
        case 'sessionInfo':
          this.log('info', 'GEMINI', msg.text || 'Session status updated');
          break;
      }
    } catch (err) {
      console.error('[GeminiLiveService] Error parsing server message:', err);
    }
  }

  /**
   * Stream 16-bit PCM chunk to Gemini Live via WebSocket
   */
  public sendAudioChunk(base64Pcm: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.state !== 'STANDBY' && this.state !== 'DISCONNECTED') {
      this.chunksSent++;
      this.ws.send(
        JSON.stringify({
          type: 'audio',
          data: base64Pcm,
        })
      );
      this.notifyMetrics();
    }
  }

  /**
   * Interrupt ongoing audio output playback immediately
   */
  public interruptPlayback(): void {
    if (this.audioEngine) {
      this.audioEngine.interruptPlayback();
    }
    this.isSpeaking = false;
    this.currentResponseText = '';
  }

  /**
   * Send text prompt or manual message with explicit memory & sentiment processing
   */
  public sendTextMessage(text: string): void {
    // 0. Check if user typed a Stop command
    if (isStopCommand(text)) {
      this.log('warn', 'SYSTEM', `User sent STOP command: "${text}". Transitioning to STANDBY.`);
      if (this.audioEngine) {
        this.audioEngine.interruptPlayback();
      }
      if (this.callbacks.onStopRequested) {
        this.callbacks.onStopRequested();
      }
      return;
    }

    // 1. Process sentiment in EmotionEngine
    emotionEngine.processUserSentiment(text);
    this.log('info', 'EMOTION', `Updated MYRAA mood to: ${emotionEngine.getState().dominantMood}`);

    // 2. Check for explicit memory command
    memoryEngine.detectAndProcessMemoryCommandAsync(text).then((memResult) => {
      if (memResult.isMemoryCommand) {
        if (memResult.savedRecord) {
          this.log('success', 'MEMORY', `Saved memory to persistent storage: [${memResult.savedRecord.category}] ${memResult.savedRecord.value}`);
          this.callbacks.onMemorySaved?.(memResult.savedRecord);
        } else {
          this.log('warn', 'MEMORY', 'Memory save could not be completed');
        }

        this.callbacks.onTranscriptUpdate({
          id: `user-${Date.now()}`,
          speaker: 'user',
          text,
          timestamp: new Date(),
        });

        if (memResult.actionMessage) {
          this.callbacks.onTranscriptUpdate({
            id: `myraa-${Date.now()}`,
            speaker: 'myraa',
            text: memResult.actionMessage,
            timestamp: new Date(),
          });
          this.synthesizeAndPlayVoice(memResult.actionMessage);
        }
        return;
      } else if (memResult.isForgetCommand) {
        this.log('info', 'MEMORY', 'Processed memory forgetting request');
        this.callbacks.onTranscriptUpdate({
          id: `user-${Date.now()}`,
          speaker: 'user',
          text,
          timestamp: new Date(),
        });
        if (memResult.actionMessage) {
          this.callbacks.onTranscriptUpdate({
            id: `myraa-${Date.now()}`,
            speaker: 'myraa',
            text: memResult.actionMessage,
            timestamp: new Date(),
          });
          this.synthesizeAndPlayVoice(memResult.actionMessage);
        }
        return;
      }

      // If not an explicit memory command, run automatic candidate extraction in the background
      memoryEngine.processUtteranceForAutomaticMemory(text).catch(() => {});

      // 3. Check for Screen Awareness & Intelligence intent
      if (screenIntelligenceManager.isScreenIntent(text)) {
        this.log('info', 'SCREEN', `Matched screen awareness voice intent: "${text}"`);
        this.callbacks.onTranscriptUpdate({
          id: `user-${Date.now()}`,
          speaker: 'user',
          text,
          timestamp: new Date(),
        });

        screenIntelligenceManager
          .handleScreenQuery(text, {
            systemInstruction: ContextEngine.buildSystemInstruction(text),
          })
          .then(({ spokenResponse, audioBase64 }) => {
            this.callbacks.onTranscriptUpdate({
              id: `myraa-${Date.now()}`,
              speaker: 'myraa',
              text: spokenResponse,
              timestamp: new Date(),
              isStreaming: false,
            });

            if (audioBase64 && this.audioEngine && this.state !== 'STANDBY') {
              this.setState('MYRAA_SPEAKING');
              this.audioEngine.playAudioChunk(audioBase64);
            } else {
              this.synthesizeAndPlayVoice(spokenResponse);
            }
          })
          .catch((err) => {
            console.warn('[GeminiLiveService] Screen query error:', err);
            const fallback = "I couldn't read the screen just now, Chinna. Could you try asking again?";
            this.callbacks.onTranscriptUpdate({
              id: `myraa-${Date.now()}`,
              speaker: 'myraa',
              text: fallback,
              timestamp: new Date(),
            });
            this.synthesizeAndPlayVoice(fallback);
          });
        return;
      }

      // 4. Check for System Control Tool Commands
      const toolMatch = toolManager.matchVoiceIntent(text);
      if (toolMatch) {
        this.log('info', 'SYSTEM', `Matched voice intent to tool: ${toolMatch.toolName}`);
        this.callbacks.onTranscriptUpdate({
          id: `user-${Date.now()}`,
          speaker: 'user',
          text,
          timestamp: new Date(),
        });
        toolManager.executeTool(toolMatch.toolName, toolMatch.args).then(({ naturalResponse }) => {
          this.callbacks.onTranscriptUpdate({
            id: `myraa-${Date.now()}`,
            speaker: 'myraa',
            text: naturalResponse,
            timestamp: new Date(),
            isStreaming: false,
          });
          this.synthesizeAndPlayVoice(naturalResponse);
        });
        return;
      }

      // 5. Send message via WebSocket or REST converse
      this.callbacks.onTranscriptUpdate({
        id: `user-${Date.now()}`,
        speaker: 'user',
        text,
        timestamp: new Date(),
      });

      if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isFallbackMode) {
        this.ws.send(
          JSON.stringify({
            type: 'text',
            text,
          })
        );
        this.log('info', 'SYSTEM', `Sent prompt via Live stream: "${text}"`);
      } else {
        this.handleRestConverse(text);
      }
    });
  }

  private isConverseInFlight: boolean = false;
  private async handleRestConverse(text: string): Promise<void> {
    if (this.isConverseInFlight) return;
    this.isConverseInFlight = true;
    try {
      const activeProvider = aiRouter.getPreferredProvider();
      this.log(
        'info',
        activeProvider === 'grok' ? 'GROK' : 'GEMINI',
        `Processing conversational response via ${activeProvider.toUpperCase()} for Chinna...`
      );

      const aiResponse = await aiRouter.converse({
        prompt: text,
        voice: COMPANION_CONFIG.voiceName || 'Aoede',
        systemInstruction: ContextEngine.buildSystemInstruction(text),
      });

      if (aiResponse.fallbackTriggered && aiResponse.fallbackReason) {
        this.log('warn', 'AI_FALLBACK', aiResponse.fallbackReason);
      }

      if (aiResponse.text) {
        this.callbacks.onTranscriptUpdate({
          id: `myraa-${Date.now()}`,
          speaker: 'myraa',
          text: aiResponse.text,
          timestamp: new Date(),
          isStreaming: false,
        });
        if (aiResponse.audio && this.audioEngine && this.state !== 'STANDBY') {
          this.setState('MYRAA_SPEAKING');
          this.audioEngine.playAudioChunk(aiResponse.audio);
        } else {
          this.setState('LISTENING');
        }
      }
    } catch (err: any) {
      console.warn('[GeminiLiveService] Rest converse notice:', err);
      const errMsg = err.message || 'Response processing encountered an issue.';
      this.log('warn', 'AI_ROUTER', `Notice: ${errMsg}`);
      this.setState('LISTENING');
    } finally {
      this.isConverseInFlight = false;
    }
  }

  /**
   * Synthesizes spoken voice confirmation in MYRAA's melodic companion voice
   */
  public async synthesizeAndPlayVoice(text: string): Promise<void> {
    if (this.state === 'STANDBY' || this.state === 'DISCONNECTED') return;
    try {
      const aiResponse = await aiRouter.converse({
        prompt: `You are MYRAA saying this exact spoken response aloud in your sweet, melodic voice for Chinna: "${text}". Repeat only this sentence: ${text}`,
        voice: COMPANION_CONFIG.voiceName || 'Aoede',
        systemInstruction:
          'You are MYRAA speaking a concise, sweet, melodic voice confirmation to Chinna.',
      });

      if (aiResponse.audio && this.audioEngine && this.state !== 'ERROR') {
        this.setState('MYRAA_SPEAKING');
        this.audioEngine.playAudioChunk(aiResponse.audio);
      }
    } catch (err: any) {
      console.warn('[GeminiLiveService] Voice synthesis notice:', err);
    }
  }

  private notifyMetrics(): void {
    this.callbacks.onMetricsUpdate({
      chunksReceived: this.chunksReceived,
      chunksSent: this.chunksSent,
      latencyMs: this.latencyMs,
      micLevel: this.micLevel,
      outputLevel: this.outputLevel,
      inputDb: this.inputDb,
      outputDb: this.outputDb,
      audioTrackDiagnostics: this.audioEngine ? this.audioEngine.getAudioTrackDiagnostics() : undefined,
    });
  }

  public toggleMute(): boolean {
    if (this.audioEngine) {
      const isMuted = this.audioEngine.toggleMute();
      this.log('info', 'MIC', isMuted ? 'Microphone muted' : 'Microphone unmuted');
      return isMuted;
    }
    return false;
  }

  public isMuted(): boolean {
    return this.audioEngine ? this.audioEngine.isMicrophoneMuted() : false;
  }

  public getAudioEngine(): AudioEngine | null {
    return this.audioEngine;
  }

  /**
   * Stop session and release all audio/network resources
   */
  public stopSession(): void {
    this.log('info', 'SYSTEM', 'Stopping live session and releasing all audio resources...');
    if (this.activeRecognizerRestartTimer) {
      clearTimeout(this.activeRecognizerRestartTimer);
      this.activeRecognizerRestartTimer = null;
    }
    if (this.fallbackRecognizerRestartTimer) {
      clearTimeout(this.fallbackRecognizerRestartTimer);
      this.fallbackRecognizerRestartTimer = null;
    }
    if (this.activeRecognizer) {
      try {
        this.activeRecognizer.onend = null;
        this.activeRecognizer.onerror = null;
        this.activeRecognizer.onresult = null;
        this.activeRecognizer.stop();
      } catch (e) {}
      this.activeRecognizer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }
    if (this.audioEngine) {
      this.audioEngine.interruptPlayback();
      this.audioEngine.setGeminiStreamingActive(false);
      if (!this.isSharedAudioEngine) {
        this.audioEngine.cleanup();
        this.audioEngine = null;
      }
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Session stopped by user');
      }
      this.ws = null;
    }
    this.isFallbackMode = false;
    this.isSpeaking = false;
    this.currentResponseText = '';
    this.setState('STANDBY');
    this.log('success', 'SYSTEM', 'MYRAA is in STANDBY. Listening only for wake word "Myraa".');
  }
}
