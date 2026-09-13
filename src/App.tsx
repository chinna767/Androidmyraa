import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CompanionState,
  DebugLog,
  TranscriptItem,
  AudioMetrics,
  EmotionalState,
  NeuralAudioDiagnostics,
} from './types';
import { MyraaAudioStateController } from './services/MyraaAudioStateController';
import { emotionEngine } from './services/EmotionEngine';
import { screenIntelligenceManager } from './services/screen/ScreenIntelligenceManager';
import { Header } from './components/Header';
import { MyraaOrb } from './components/MyraaOrb';
import { LiveTranscript } from './components/LiveTranscript';
import { VoiceControls } from './components/VoiceControls';
import { YouTubePlayer } from './components/YouTubePlayer';
import { MemoryModal } from './components/MemoryModal';
import { DebugPanel } from './components/DebugPanel';
import { AISettingsModal } from './components/AISettingsModal';
import { aiRouter } from './services/ai/AIRouter';
import { AIProviderType } from './types';

export default function App() {
  const [state, setState] = useState<CompanionState>('STANDBY');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [micEnabled, setMicEnabled] = useState<boolean>(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState<boolean>(true);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [activeProvider, setActiveProvider] = useState<AIProviderType>(
    aiRouter.getPreferredProvider()
  );
  const [isAISettingsOpen, setIsAISettingsOpen] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<AudioMetrics>({
    micLevel: 0,
    outputLevel: 0,
    inputDb: -100,
    outputDb: -100,
    chunksReceived: 0,
    chunksSent: 0,
    latencyMs: 0,
  });
  const [diagnostics, setDiagnostics] = useState<NeuralAudioDiagnostics>({
    wakeWordState: 'STANDBY',
    wakeDetectorStatus: 'RUNNING',
    micStatus: 'ACTIVE',
    modelStatus: 'READY',
    modelName: 'Myraa-MicroWakeWord-Conv2D-v1',
    isMyraaClassTrained: true,
    wakeWordConfidence: 0,
    wakeWordThreshold: 0.75,
    vadState: 'STANDBY',
    vadProbability: 0,
    vadThreshold: 0.58,
    tensorFlowStatus: 'READY',
    tensorFlowBackend: 'wasm',
    geminiStatus: 'DISCONNECTED',
    audioState: 'STANDBY',
    inferenceLatencyMs: 12,
    interruptionCount: 0,
    framesReceivedInStandby: 0,
  });
  const [emotionalState, setEmotionalState] = useState<EmotionalState>(emotionEngine.getState());
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState<boolean>(false);

  const controllerRef = useRef<MyraaAudioStateController | null>(null);

  useEffect(() => {
    // 1. Subscribe to Emotion updates
    const unsubEmotion = emotionEngine.subscribe((newEmotion) => {
      setEmotionalState(newEmotion);
    });

    // 2. Set screen intelligence log callback
    screenIntelligenceManager.setLogCallback((log) => {
      const newLog: DebugLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        ...log,
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 150)]);
    });

    // 3. Initialize Master Audio & Neural Controller
    const controller = new MyraaAudioStateController({
      onStateChange: (newState) => {
        setState(newState);
      },
      onTranscriptUpdate: (item) => {
        setTranscript((prev) => {
          const index = prev.findIndex((p) => p.id === item.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = item;
            return updated;
          }
          return [...prev, item];
        });
      },
      onDebugLog: (log) => {
        const newLog: DebugLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          ...log,
        };
        setLogs((prev) => [newLog, ...prev.slice(0, 150)]);
      },
      onMetricsUpdate: (newMetrics) => {
        setMetrics((prev) => ({ ...prev, ...newMetrics }));
      },
      onDiagnosticsUpdate: (diag) => {
        setDiagnostics(diag);
        if (controllerRef.current) {
          setMicEnabled(controllerRef.current.isMicrophoneEnabled());
        }
      },
      onError: (err) => {
        console.error('[App] Error from controller:', err);
      },
    });

    controllerRef.current = controller;

    // 4. Subscribe to AI Router Fallback notices
    const unsubFallback = aiRouter.subscribeFallbackNotice((notice) => {
      const newLog: DebugLog = {
        id: `log-fallback-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'warn',
        source: 'AI_ROUTER',
        message: notice.message,
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 150)]);
    });

    // Start in STANDBY mode
    controller.startStandby();

    return () => {
      unsubEmotion();
      unsubFallback();
      controller.cleanup();
      controllerRef.current = null;
    };
  }, []);

  const handleStartSession = async () => {
    if (controllerRef.current) {
      await controllerRef.current.handleWakeWordTriggered(1.0);
    }
  };

  const handleStopSession = async () => {
    if (controllerRef.current) {
      await controllerRef.current.enterStandby();
    }
  };

  const handleToggleMute = () => {
    if (controllerRef.current) {
      const muted = controllerRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const handleToggleMic = async () => {
    if (controllerRef.current) {
      const isNowEnabled = await controllerRef.current.toggleMicrophone();
      setMicEnabled(isNowEnabled);
    }
  };

  const handleToggleWakeWord = () => {
    setWakeWordEnabled((prev) => !prev);
  };

  const handleSendText = (text: string) => {
    if (controllerRef.current) {
      const gemini = controllerRef.current.getGeminiLiveService();
      if (gemini) {
        gemini.sendTextMessage(text);
      }
    }
  };

  const handleEnableMicrophone = async () => {
    if (controllerRef.current) {
      await controllerRef.current.ensureMicrophoneActive();
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleWakeWordThresholdChange = (val: number) => {
    controllerRef.current?.setWakeWordThreshold(val);
  };

  const handleVadThresholdChange = (val: number) => {
    controllerRef.current?.setVadThreshold(val);
  };

  return (
    <div
      id="myraa-app-root"
      className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden font-sans selection:bg-purple-600 selection:text-white"
    >
      {/* Ambient background glow & radial highlights */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-purple-900/20 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] bg-pink-900/15 rounded-full blur-[130px]" />
        <div className="absolute -bottom-20 -right-20 w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
      </div>

      {/* Top Application Bar */}
      <div className="relative z-10 w-full border-b border-slate-900/80 bg-slate-950/40 backdrop-blur-md">
        <Header
          state={state}
          emotionalState={emotionalState}
          isDebugOpen={isDebugOpen}
          onToggleDebug={() => setIsDebugOpen((prev) => !prev)}
          isAISettingsOpen={isAISettingsOpen}
          onToggleAISettings={() => setIsAISettingsOpen((prev) => !prev)}
          activeProvider={activeProvider}
        />
      </div>

      {/* Main Core Stage */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-3 max-w-4xl mx-auto w-full">
        {/* Neural Visualizer Orb */}
        <div className="relative my-auto flex flex-col items-center">
          <MyraaOrb
            state={state}
            micLevel={metrics.micLevel}
            outputLevel={metrics.outputLevel}
            audioEngine={controllerRef.current?.getAudioEngine() || null}
          />
        </div>

        {/* Embedded Real YouTube Player Controller */}
        <YouTubePlayer />

        {/* Live Conversation Transcript */}
        <LiveTranscript transcript={transcript} />

        {/* Voice & System Control Bar */}
        <div className="w-full mt-2">
          <VoiceControls
            state={state}
            isMuted={isMuted}
            micEnabled={micEnabled}
            wakeWordEnabled={wakeWordEnabled}
            diagnostics={diagnostics}
            onStartSession={handleStartSession}
            onStopSession={handleStopSession}
            onToggleMute={handleToggleMute}
            onToggleMic={handleToggleMic}
            onToggleWakeWord={handleToggleWakeWord}
            onEnableMicrophone={handleEnableMicrophone}
            onSendText={handleSendText}
          />
        </div>
      </main>

      {/* Slide-in Pipeline & Diagnostic Telemetry Panel */}
      <AnimatePresence>
        {isDebugOpen && (
          <DebugPanel
            isOpen={isDebugOpen}
            onClose={() => setIsDebugOpen(false)}
            logs={logs}
            metrics={metrics}
            diagnostics={diagnostics}
            onClearLogs={handleClearLogs}
            onWakeWordThresholdChange={handleWakeWordThresholdChange}
            onVadThresholdChange={handleVadThresholdChange}
            micEnabled={micEnabled}
            onToggleMic={handleToggleMic}
          />
        )}
      </AnimatePresence>

      {/* Persistent Memory Modal */}
      <MemoryModal isOpen={isMemoryOpen} onClose={() => setIsMemoryOpen(false)} />

      {/* AI API Settings Modal */}
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
        onSettingsSaved={(newSettings) => {
          setActiveProvider(newSettings.preferredProvider);
          const newLog: DebugLog = {
            id: `log-settings-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: 'info',
            source: 'AI_ROUTER',
            message: `AI Settings updated: Preferred Provider set to ${newSettings.preferredProvider.toUpperCase()}`,
          };
          setLogs((prev) => [newLog, ...prev.slice(0, 150)]);
        }}
      />
    </div>
  );
}
