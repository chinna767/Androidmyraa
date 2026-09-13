import React, { useState, useEffect } from 'react';
import {
  X,
  Volume2,
  Sliders,
  Sparkles,
  Sun,
  Flashlight,
  Clock,
  Calendar,
  Layers,
  Activity,
  Cpu,
  Brain,
  Trash2,
  RefreshCw,
  Zap,
  Eye,
  Code,
  AlertTriangle,
  Monitor,
  CheckCircle2,
  Play,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ShieldCheck,
  UserCheck,
  Mic,
  MicOff,
} from 'lucide-react';
import { DebugLog, AudioMetrics, NeuralAudioDiagnostics, SystemStateSnapshot, ScreenAwarenessState, ScreenUnderstandingResult, CallState, CallDiagnostics, ContactRecord } from '../types';
import { systemControlManager } from '../services/SystemControlManager';
import { systemCapabilities } from '../services/SystemCapabilities';
import { memoryEngine } from '../services/MemoryEngine';
import { screenIntelligenceManager } from '../services/screen/ScreenIntelligenceManager';
import { screenContextManager } from '../services/screen/ScreenContextManager';
import { callManager } from '../services/call/CallManager';
import { callStateManager } from '../services/call/CallStateManager';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DebugLog[];
  metrics: AudioMetrics;
  diagnostics?: NeuralAudioDiagnostics;
  onClearLogs: () => void;
  onWakeWordThresholdChange?: (val: number) => void;
  onVadThresholdChange?: (val: number) => void;
  micEnabled?: boolean;
  onToggleMic?: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isOpen,
  onClose,
  logs,
  metrics,
  diagnostics,
  onClearLogs,
  onWakeWordThresholdChange,
  onVadThresholdChange,
  micEnabled = true,
  onToggleMic,
}) => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'system' | 'screen' | 'calls' | 'memory' | 'logs'>('pipeline');
  const [systemState, setSystemState] = useState<SystemStateSnapshot>(systemControlManager.getStateSnapshot());
  const capabilities = systemCapabilities.getCapabilities();
  const [memories, setMemories] = useState(memoryEngine.getAllMemories());
  const [screenState, setScreenState] = useState<ScreenAwarenessState>(screenIntelligenceManager.getState());
  const [lastScreenResult, setLastScreenResult] = useState<ScreenUnderstandingResult | null>(
    screenContextManager.getContext()?.result || null
  );
  const [isTriggeringScreen, setIsTriggeringScreen] = useState(false);
  const [callState, setCallState] = useState<CallState>(callStateManager.getState());
  const [callDiagnostics, setCallDiagnostics] = useState<CallDiagnostics>(callManager.getDiagnostics());
  const [contactsList, setContactsList] = useState<ContactRecord[]>(callManager.contacts.getAllContacts());
  const [callSettings, setCallSettings] = useState(callManager.getSettings());

  useEffect(() => {
    const unsubSystem = systemControlManager.subscribeState((st) => {
      setSystemState(st);
    });
    const unsubMemory = memoryEngine.subscribe((mems) => {
      setMemories(mems);
    });
    const unsubScreen = screenIntelligenceManager.subscribe((sc) => {
      setScreenState(sc);
      const ctx = screenContextManager.getContext();
      if (ctx) {
        setLastScreenResult(ctx.result);
      }
    });
    const unsubCalls = callStateManager.subscribe((state) => {
      setCallState(state);
      setCallDiagnostics(callManager.getDiagnostics());
    });
    return () => {
      unsubSystem();
      unsubMemory();
      unsubScreen();
      unsubCalls();
    };
  }, []);

  const handleTestScreenAnalysis = async (queryText: string) => {
    setIsTriggeringScreen(true);
    try {
      const res = await screenIntelligenceManager.handleScreenQuery(queryText);
      if (res.result) {
        setLastScreenResult(res.result);
      }
    } finally {
      setIsTriggeringScreen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      id="debug-panel"
      aria-label="Diagnostics and settings"
      className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-slate-950/95 border-l border-purple-900/50 shadow-2xl backdrop-blur-2xl z-50 flex flex-col overflow-hidden transition-all duration-300"
    >
      {/* Panel Top Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">SYSTEM &amp; PIPELINE</h2>
            <p className="text-[10px] text-purple-300/80 font-mono">Real-time on-device telemetry</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleMic && (
            <button
              id="btn-panel-toggle-microphone"
              onClick={onToggleMic}
              title={
                micEnabled
                  ? 'Microphone is ON (Listening allowed - click to turn OFF)'
                  : 'Microphone is OFF (Capture stopped - click to turn ON)'
              }
              aria-label={micEnabled ? 'Microphone ON - click to turn OFF' : 'Microphone OFF - click to turn ON'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition-all ${
                micEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30'
              }`}
            >
              {micEnabled ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  <span>MIC ON</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>MIC OFF</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-slate-800/80 bg-slate-950 px-2 py-1 gap-1 text-xs">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'pipeline'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Pipeline</span>
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'system'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Device Controls</span>
        </button>
        <button
          onClick={() => setActiveTab('screen')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'screen'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Screen</span>
        </button>
        <button
          onClick={() => setActiveTab('calls')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'calls'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Calls ({callState})</span>
        </button>
        <button
          onClick={() => setActiveTab('memory')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'memory'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Memory ({memories.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'logs'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Logs ({logs.length})</span>
        </button>
      </div>

      {/* Main Tab View Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
        {/* ========================================================================= */}
        {/* TAB 1: PIPELINE & TELEMETRY */}
        {/* ========================================================================= */}
        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            {/* Live Audio Metrics */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <Activity className="w-3.5 h-3.5" />
                  AUDIO ENGINE STREAMS
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-400 font-semibold">16kHz IN • 24kHz OUT</span>
                  {onToggleMic && (
                    <button
                      onClick={onToggleMic}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${
                        micEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                      }`}
                    >
                      {micEnabled ? <Mic className="w-3 h-3 text-emerald-400" /> : <MicOff className="w-3 h-3 text-rose-400" />}
                      <span>{micEnabled ? 'MIC ON' : 'MIC OFF'}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Mic Level:</span>
                    <span className="text-sky-300">{Math.round(metrics.micLevel * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-400 h-full transition-all duration-75"
                      style={{ width: `${Math.min(100, metrics.micLevel * 100)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1">Peak: {metrics.inputDb} dBFS</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Speaker Out:</span>
                    <span className="text-pink-300">{Math.round(metrics.outputLevel * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-pink-500 h-full transition-all duration-75"
                      style={{ width: `${Math.min(100, metrics.outputLevel * 100)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1">Peak: {metrics.outputDb} dBFS</p>
                </div>
              </div>
            </div>

            {/* Neural Diagnostics Box */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  ON-DEVICE NEURAL MODELS
                </span>
                <span className="text-[10px] text-purple-400">
                  {diagnostics?.tensorFlowBackend?.toUpperCase() || 'WASM'}
                </span>
              </div>

              {/* Neural Wake-Word */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-pink-400" />
                    Wake Word: &quot;Myraa&quot;
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      diagnostics?.wakeWordState === 'READY'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : diagnostics?.wakeWordState === 'DETECTED'
                        ? 'bg-pink-950 text-pink-300 border border-pink-800 animate-pulse'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {diagnostics?.wakeWordState || 'STANDBY'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Confidence:</span>
                  <span className="text-slate-200 font-bold">
                    {Math.round((diagnostics?.wakeWordConfidence || 0) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-400 h-full transition-all duration-100"
                    style={{ width: `${Math.min(100, (diagnostics?.wakeWordConfidence || 0) * 100)}%` }}
                  />
                </div>
                {onWakeWordThresholdChange && (
                  <div className="pt-1 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Threshold:</span>
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={diagnostics?.wakeWordThreshold || 0.75}
                      onChange={(e) => onWakeWordThresholdChange(parseFloat(e.target.value))}
                      className="w-24 accent-purple-500"
                    />
                    <span className="text-purple-300">
                      {Math.round((diagnostics?.wakeWordThreshold || 0.75) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Neural VAD */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold flex items-center gap-1">
                    <Activity className="w-3 h-3 text-sky-400" />
                    Neural VAD (Speech Onset/Offset)
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      diagnostics?.vadState === 'SPEECH'
                        ? 'bg-sky-950 text-sky-300 border border-sky-800 animate-pulse'
                        : diagnostics?.vadState === 'SILENCE'
                        ? 'bg-slate-900 text-slate-400 border border-slate-800'
                        : 'bg-slate-900 text-slate-500'
                    }`}
                  >
                    {diagnostics?.vadState || 'STANDBY'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Speech Probability:</span>
                  <span className="text-slate-200 font-bold">
                    {Math.round((diagnostics?.vadProbability || 0) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-400 h-full transition-all duration-100"
                    style={{ width: `${Math.min(100, (diagnostics?.vadProbability || 0) * 100)}%` }}
                  />
                </div>
                {onVadThresholdChange && (
                  <div className="pt-1 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Threshold:</span>
                    <input
                      type="range"
                      min="0.3"
                      max="0.9"
                      step="0.05"
                      value={diagnostics?.vadThreshold || 0.58}
                      onChange={(e) => onVadThresholdChange(parseFloat(e.target.value))}
                      className="w-24 accent-sky-500"
                    />
                    <span className="text-sky-300">
                      {Math.round((diagnostics?.vadThreshold || 0.58) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Real Pipeline Telemetry Diagnostic Inspector */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-slate-300 font-bold border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5 text-pink-300">
                  <Activity className="w-3.5 h-3.5 text-pink-400" />
                  WAKE WORD REAL PIPELINE DIAGNOSTIC
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  diagnostics?.wakeDetectorStatus === 'RUNNING'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {diagnostics?.wakeDetectorStatus || 'STANDBY'}
                </span>
              </div>

              {/* 1. AUDIO INPUT */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px] text-sky-400">
                  <span>1. AUDIO INPUT (Microphone Capture)</span>
                  {onToggleMic && (
                    <button
                      onClick={onToggleMic}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${
                        micEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                      }`}
                    >
                      {micEnabled ? <Mic className="w-3 h-3 text-emerald-400" /> : <MicOff className="w-3 h-3 text-rose-400" />}
                      <span>{micEnabled ? 'MIC ON' : 'MIC OFF'}</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400">
                  <div className="flex justify-between">
                    <span>AudioContext Rate:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.audioContextSampleRate ?? 16000} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mic Sample Rate:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.micSampleRate ?? 16000} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Channel Count:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.channelCount ?? 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mono / Stereo:</span>
                    <span className="text-emerald-400">{diagnostics?.wakeWordTelemetry?.isMono ? 'Mono (Native)' : 'Stereo'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buffer Size:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.bufferSize ?? 2048} samples</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Raw RMS:</span>
                    <span className="text-purple-300">{diagnostics?.wakeWordTelemetry?.rawRms ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Peak Amplitude:</span>
                    <span className="text-pink-300">{diagnostics?.wakeWordTelemetry?.peakAmplitude ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Amplitude:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.averageAmplitude ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* 2. AUDIO PROCESSING */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="text-slate-300 font-semibold text-[11px] text-purple-400">
                  2. AUDIO PROCESSING & RESAMPLING
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Input Sample Rate:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.inputSampleRate ?? 16000} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Sample Rate:</span>
                    <span className="text-emerald-400">{diagnostics?.wakeWordTelemetry?.targetSampleRate ?? 16000} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resampled Rate:</span>
                    <span className="text-emerald-400">{diagnostics?.wakeWordTelemetry?.resampledSampleRate ?? 16000} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Number of Samples:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.numSamples ?? 2048}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PCM Range:</span>
                    <span className="text-amber-300">{diagnostics?.wakeWordTelemetry?.pcmRange ?? '[-1.0, 1.0] Float32'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min PCM Value:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.minPcm ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max PCM Value:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.maxPcm ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mean Value:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.meanPcm ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* 3. FEATURE HEALTH */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="text-slate-300 font-semibold text-[11px] text-amber-400">
                  3. FEATURE HEALTH (Log-Mel Spectrogram)
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Feature Min:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.featureMin ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Feature Max:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.featureMax ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Feature Mean:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.featureMean ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Feature Variance:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.featureVariance ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* 4. MODEL SPECIFICATIONS */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                <div className="text-slate-300 font-semibold text-[11px] text-emerald-400">
                  4. MODEL SPECIFICATIONS
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Model Loaded:</span>
                    <span className="text-emerald-400 font-bold">{diagnostics?.wakeWordTelemetry?.isModelLoaded ? 'TRUE' : 'FALSE'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Input Shape:</span>
                    <span className="text-slate-200">{JSON.stringify(diagnostics?.wakeWordTelemetry?.modelInputShape ?? [1, 40, 40, 1])}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Input Data Type:</span>
                    <span className="text-slate-200">{diagnostics?.wakeWordTelemetry?.modelInputDataType ?? 'Float32'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expected Feature:</span>
                    <span className="text-slate-200">{JSON.stringify(diagnostics?.wakeWordTelemetry?.expectedFeatureShape ?? [40, 40])}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Actual Feature:</span>
                    <span className="text-slate-200">{JSON.stringify(diagnostics?.wakeWordTelemetry?.actualFeatureShape ?? [40, 40])}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Model Output Shape:</span>
                    <span className="text-slate-200">{JSON.stringify(diagnostics?.wakeWordTelemetry?.modelOutputShape ?? [1, 3])}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output Classes:</span>
                    <span className="text-purple-300 font-bold">{diagnostics?.wakeWordTelemetry?.numOutputClasses ?? 3}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wake Word Index:</span>
                    <span className="text-pink-300 font-bold">Class {diagnostics?.wakeWordTelemetry?.wakeWordClassIndex ?? 2} (&quot;Myraa&quot;)</span>
                  </div>
                </div>
              </div>

              {/* 5. INFERENCE & PREDICTIONS */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px] text-pink-400">
                  <span>5. INFERENCE & PREDICTIONS</span>
                  <span className="text-[10px] text-slate-400">{diagnostics?.lastInferenceTimestamp || '00:00:00.000'}</span>
                </div>
                <div className="space-y-1.5 text-[10px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Raw Output Values (Logits):</span>
                    <span className="text-slate-300 font-mono">[{diagnostics?.wakeWordTelemetry?.rawOutputValues?.join(', ') || '0, 0, 0'}]</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output Probabilities:</span>
                    <span className="text-purple-300 font-mono">[{diagnostics?.wakeWordTelemetry?.outputProbabilities?.join(', ') || '1.0, 0.0, 0.0'}]</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900">
                    <div className="flex justify-between">
                      <span>Highest Probability:</span>
                      <span className="text-emerald-400 font-bold">{diagnostics?.wakeWordTelemetry?.highestProbability ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Predicted Class:</span>
                      <span className="text-sky-300 font-bold">[{diagnostics?.wakeWordTelemetry?.highestProbabilityClassIndex ?? 0}] {diagnostics?.wakeWordTelemetry?.highestProbabilityClassLabel ?? '_silence_'}</span>
                    </div>
                  </div>
                  <div className="p-2 rounded bg-purple-950/40 border border-purple-800/50 space-y-1.5 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-200 font-bold">Wake Word (&quot;Myraa&quot;) Confidence:</span>
                      <span className={`text-base font-extrabold ${
                        (diagnostics?.wakeWordConfidence || 0) >= (diagnostics?.wakeWordThreshold || 0.75)
                          ? 'text-pink-400 animate-pulse'
                          : 'text-purple-300'
                      }`}>
                        {Math.round((diagnostics?.wakeWordConfidence || 0) * 100)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-purple-900/40">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Smoothed (EMA):</span>
                        <span className="text-pink-300 font-semibold">
                          {Math.round(((diagnostics?.wakeWordTelemetry?.smoothedConfidence ?? diagnostics?.wakeWordConfidence) || 0) * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Consecutive Frames:</span>
                        <span className="text-emerald-400 font-semibold">
                          {diagnostics?.wakeWordTelemetry?.consecutiveDetections ?? 0} / 3
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] pt-1 border-t border-purple-900/40 flex justify-between">
                      <span className="text-slate-400">Decision:</span>
                      <span className={`font-semibold ${
                        diagnostics?.wakeWordTelemetry?.wakeDecision === 'WAKE ACCEPTED'
                          ? 'text-emerald-400'
                          : diagnostics?.wakeWordTelemetry?.wakeDecision === 'REJECTED'
                          ? 'text-amber-400'
                          : 'text-sky-300'
                      }`}>
                        {diagnostics?.wakeWordTelemetry?.wakeDecision || 'LISTENING'}
                      </span>
                    </div>
                    {diagnostics?.wakeWordTelemetry?.rejectionReason && (
                      <div className="text-[9px] text-slate-400 italic">
                        Reason: {diagnostics.wakeWordTelemetry.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: REAL DEVICE CONTROLS & CAPABILITIES */}
        {/* ========================================================================= */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            {/* Quick Hardware Controls */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <Sliders className="w-3.5 h-3.5" />
                  GENUINE HARDWARE CONTROLS
                </span>
              </div>

              {/* Master Microphone Switch */}
              {onToggleMic && (
                <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    {micEnabled ? (
                      <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <MicOff className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    Hardware Microphone
                  </span>
                  <button
                    onClick={onToggleMic}
                    className={`px-3 py-1 rounded-lg border text-xs font-mono font-bold transition-all shadow-sm ${
                      micEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30'
                    }`}
                  >
                    {micEnabled ? 'MIC ON' : 'MIC OFF'}
                  </button>
                </div>
              )}

              {/* Volume Slider */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                    System Volume
                  </span>
                  <span className="font-bold text-purple-300">{systemState.volume.level}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={systemState.volume.level}
                  onChange={(e) => systemControlManager.set_volume(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Brightness Slider */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    Screen Brightness
                  </span>
                  <span className="font-bold text-amber-300">{systemState.brightness.level}%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="100"
                  value={systemState.brightness.level}
                  onChange={(e) => systemControlManager.set_brightness(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Torch Toggle */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Flashlight className="w-3.5 h-3.5 text-yellow-400" />
                  Flashlight / Torch
                </span>
                <button
                  onClick={() => systemControlManager.torch_toggle()}
                  className={`px-3 py-1 rounded-lg font-bold text-xs border transition-all ${
                    systemState.torch.isOn
                      ? 'bg-yellow-500 text-slate-950 border-yellow-400 shadow-md shadow-yellow-500/20'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {systemState.torch.isOn ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Real Clock / Time */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Clock className="w-3 h-3 text-sky-400" />
                    <span>Current Time</span>
                  </div>
                  <p className="text-xs font-bold text-white">{systemState.currentTime || 'Active'}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Calendar className="w-3 h-3 text-pink-400" />
                    <span>Current Date</span>
                  </div>
                  <p className="text-[11px] font-bold text-white truncate">
                    {systemState.currentDate || 'Active'}
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Capability Boundary Matrix */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span>DEVICE CAPABILITY MATRIX</span>
                <span className="text-[10px] text-purple-400">
                  {systemCapabilities.getCapabilityInfo().osName}
                </span>
              </div>
              <div className="space-y-1.5">
                {capabilities.map((cap) => (
                  <div
                    key={cap.name}
                    className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/60 flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">{cap.name}</p>
                      <p className="text-[10px] text-slate-400">{cap.notes}</p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        cap.status === 'available'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : cap.status === 'limited'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {cap.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SCREEN AWARENESS & CODE ASSISTANT */}
        {/* ========================================================================= */}
        {activeTab === 'screen' && (
          <div className="space-y-4">
            {/* Screen Controls Card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <Monitor className="w-3.5 h-3.5" />
                  SCREEN INTELLIGENCE
                </span>
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                    screenState.enabled
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {screenState.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {/* Toggle Screen Awareness */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-200">Screen Awareness</p>
                  <p className="text-[10px] text-slate-400">Allow MYRAA to view and analyze screen</p>
                </div>
                <button
                  onClick={() => screenIntelligenceManager.toggleScreenAwareness()}
                  className={`px-3 py-1 rounded-lg font-bold text-xs border transition-all ${
                    screenState.enabled
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-900/30'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {screenState.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Allow Screen Analysis Switch */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-200">Allow Screen Analysis</p>
                  <p className="text-[10px] text-slate-400">Enable Gemini Multimodal code & error inspection</p>
                </div>
                <button
                  onClick={() => screenIntelligenceManager.setAllowAnalysis(!screenState.allowAnalysis)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs border transition-all ${
                    screenState.allowAnalysis
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {screenState.allowAnalysis ? 'YES' : 'NO'}
                </button>
              </div>

              {/* Screen Debug Mode Toggle */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-200">Screen Debug Mode</p>
                  <p className="text-[10px] text-slate-400">Root-cause & step-by-step fix explanations</p>
                </div>
                <button
                  onClick={() => screenIntelligenceManager.setScreenDebugMode(!screenState.screenDebugMode)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs border transition-all ${
                    screenState.screenDebugMode
                      ? 'bg-pink-600 text-white border-pink-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {screenState.screenDebugMode ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Instant Test Triggers */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                TEST SCREEN ACTIONS
              </span>
              <div className="grid grid-cols-1 gap-2">
                <button
                  disabled={isTriggeringScreen}
                  onClick={() => handleTestScreenAnalysis('Look at my screen and explain what you see.')}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-purple-500/50 text-slate-200 text-[11px] font-semibold transition-all disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-purple-400" />
                    "Myraa, look at my screen."
                  </span>
                  <Play className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  disabled={isTriggeringScreen}
                  onClick={() => handleTestScreenAnalysis('Explain this code and what it does.')}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-purple-500/50 text-slate-200 text-[11px] font-semibold transition-all disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-sky-400" />
                    "Explain this code."
                  </span>
                  <Play className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  disabled={isTriggeringScreen}
                  onClick={() => handleTestScreenAnalysis('What is wrong here? Why am I getting this error?')}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-purple-500/50 text-slate-200 text-[11px] font-semibold transition-all disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    "Why am I getting this error?"
                  </span>
                  <Play className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Latest Visual Analysis Card */}
            {lastScreenResult && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    LATEST SCREEN UNDERSTANDING
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    {lastScreenResult.category}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-800/80">
                  {lastScreenResult.summary}
                </p>

                {lastScreenResult.codeAnalysis && (
                  <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80 space-y-1 text-[10px]">
                    <div className="flex justify-between text-purple-300 font-bold">
                      <span>Language: {lastScreenResult.codeAnalysis.language || 'Detected'}</span>
                    </div>
                    {lastScreenResult.codeAnalysis.predictedOutput && (
                      <p className="text-slate-400">
                        <span className="text-slate-300 font-semibold">Predicted Output:</span> {lastScreenResult.codeAnalysis.predictedOutput}
                      </p>
                    )}
                  </div>
                )}

                {lastScreenResult.errorAnalysis?.hasError && (
                  <div className="p-2 rounded bg-rose-950/30 border border-rose-800/50 space-y-1 text-[10px]">
                    <p className="text-rose-300 font-bold">
                      {lastScreenResult.errorAnalysis.errorType || 'Error Detected'}: {lastScreenResult.errorAnalysis.errorMessage}
                    </p>
                    {lastScreenResult.errorAnalysis.suggestedFix && (
                      <p className="text-emerald-300">
                        <span className="font-semibold">Fix:</span> {lastScreenResult.errorAnalysis.suggestedFix}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: UNIFIED PHONE CALL MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === 'calls' && (
          <div className="space-y-4">
            {/* Live Call State Card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <PhoneCall className="w-3.5 h-3.5" />
                  TELECOM CALL PIPELINE
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    callState === 'IN_CALL'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : callState === 'INCOMING_RINGING' || callState === 'WAITING_FOR_USER_DECISION'
                      ? 'bg-pink-950 text-pink-400 border-pink-800 animate-pulse'
                      : callState === 'OUTGOING_CONFIRMATION' || callState === 'OUTGOING_DIALING'
                      ? 'bg-amber-950 text-amber-400 border-amber-800'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  {callState}
                </span>
              </div>

              {/* Active Call Details Banner */}
              {callDiagnostics.lastCaller && callState !== 'IDLE' && (
                <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-100 text-xs">
                        {callDiagnostics.lastCaller.name || 'Unknown Caller'}
                      </p>
                      <p className="text-[10px] text-purple-300 font-mono">
                        {callDiagnostics.lastCaller.maskedNumber}
                      </p>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        callDiagnostics.lastCaller.isUnknown
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                      }`}
                    >
                      {callDiagnostics.lastCaller.isUnknown ? 'Unknown Number' : 'Known Contact'}
                    </span>
                  </div>

                  {callState === 'WAITING_FOR_USER_DECISION' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => callManager.answerIncomingCall()}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center justify-center gap-1 transition-all"
                      >
                        <PhoneIncoming className="w-3 h-3" />
                        <span>Pick Up ("Yes")</span>
                      </button>
                      <button
                        onClick={() => callManager.rejectIncomingCall()}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] flex items-center justify-center gap-1 transition-all"
                      >
                        <PhoneMissed className="w-3 h-3" />
                        <span>Decline ("No")</span>
                      </button>
                    </div>
                  )}

                  {callState === 'OUTGOING_CONFIRMATION' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => callManager.confirmPendingCall()}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] flex items-center justify-center gap-1 transition-all"
                      >
                        <PhoneOutgoing className="w-3 h-3" />
                        <span>Confirm ("Call Now")</span>
                      </button>
                      <button
                        onClick={() => callManager.cancelPendingCall()}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] flex items-center justify-center gap-1 transition-all"
                      >
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}

                  {callState === 'IN_CALL' && (
                    <div className="pt-1">
                      <button
                        onClick={() => callManager.incoming.handleCallDisconnected()}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-semibold text-[11px] flex items-center justify-center gap-1 transition-all"
                      >
                        <span>End Call</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Telemetry Metrics */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <span className="text-slate-500 block">AUDIO SUPPRESSION</span>
                  <span
                    className={`font-bold ${
                      callDiagnostics.isAssistantAudioSuppressed ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {callDiagnostics.isAssistantAudioSuppressed ? 'MUTED (In-Call)' : 'NORMAL'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <span className="text-slate-500 block">LAST LATENCY</span>
                  <span className="font-bold text-slate-200">
                    {callDiagnostics.lastExecutionLatencyMs}ms
                  </span>
                </div>
              </div>
            </div>

            {/* Test Simulation Controls */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <span className="flex items-center gap-1.5 text-purple-300 font-bold">
                <Zap className="w-3.5 h-3.5" />
                VOICE &amp; TELECOM SIMULATOR
              </span>
              <p className="text-[10px] text-slate-400">
                Trigger real incoming call announcements or outgoing contact resolutions:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => callManager.simulateIncomingCallForTesting('+91 98765 43210')}
                  className="p-2 rounded-lg bg-slate-950/80 hover:bg-purple-950/60 border border-slate-800 text-left text-[11px] text-slate-200 hover:border-purple-700 transition-all flex items-center gap-1.5"
                >
                  <PhoneIncoming className="w-3 h-3 text-pink-400" />
                  <span>Incoming: Mom</span>
                </button>
                <button
                  onClick={() => callManager.simulateIncomingCallForTesting('+91 91234 56789')}
                  className="p-2 rounded-lg bg-slate-950/80 hover:bg-purple-950/60 border border-slate-800 text-left text-[11px] text-slate-200 hover:border-purple-700 transition-all flex items-center gap-1.5"
                >
                  <PhoneIncoming className="w-3 h-3 text-purple-400" />
                  <span>Incoming: Rahul</span>
                </button>
                <button
                  onClick={() => callManager.simulateIncomingCallForTesting('+1 415 555 0199')}
                  className="p-2 rounded-lg bg-slate-950/80 hover:bg-purple-950/60 border border-slate-800 text-left text-[11px] text-slate-200 hover:border-purple-700 transition-all flex items-center gap-1.5"
                >
                  <PhoneIncoming className="w-3 h-3 text-amber-400" />
                  <span>Incoming: Unknown</span>
                </button>
                <button
                  onClick={() => callManager.callContact('Mom')}
                  className="p-2 rounded-lg bg-slate-950/80 hover:bg-purple-950/60 border border-slate-800 text-left text-[11px] text-slate-200 hover:border-purple-700 transition-all flex items-center gap-1.5"
                >
                  <PhoneOutgoing className="w-3 h-3 text-emerald-400" />
                  <span>Outgoing: Call Mom</span>
                </button>
              </div>
            </div>

            {/* Local Private Contact Directory */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <UserCheck className="w-3.5 h-3.5" />
                  LOCAL CONTACT RESOLVER (PRIVATE)
                </span>
                <span className="text-[10px] text-slate-400">{contactsList.length} contacts</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Contacts are resolved entirely on-device. Raw database is never sent to Gemini.
              </p>
              <div className="space-y-1.5">
                {contactsList.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-200 text-[11px]">{contact.name}</span>
                        {contact.relationship && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800/50">
                            {contact.relationship}
                          </span>
                        )}
                        {contact.isStarred && (
                          <span className="text-amber-400 text-[10px]">★</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {callManager.callerId.maskPhoneNumber(contact.phoneNumber)}
                      </span>
                    </div>
                    <button
                      onClick={() => callManager.callContact(contact.name)}
                      className="px-2 py-1 rounded bg-purple-900/40 hover:bg-purple-900/80 text-purple-200 text-[10px] font-semibold transition-all border border-purple-700/40"
                    >
                      Call
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Safety & Settings */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <span className="flex items-center gap-1.5 text-purple-300 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                CALL SAFETY &amp; PRIVACY
              </span>
              <div className="space-y-2 text-[11px]">
                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 cursor-pointer">
                  <div>
                    <p className="font-bold text-slate-200">Confirm Outgoing Calls</p>
                    <p className="text-[10px] text-slate-400">Ask Chinna before placing calls to contacts</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={callSettings.confirmOutgoingCalls}
                    onChange={(e) => {
                      const updated = { confirmOutgoingCalls: e.target.checked };
                      callManager.updateSettings(updated);
                      setCallSettings((prev) => ({ ...prev, ...updated }));
                    }}
                    className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-slate-700"
                  />
                </label>
                <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 cursor-pointer">
                  <div>
                    <p className="font-bold text-slate-200">Announce &amp; Ask on Incoming</p>
                    <p className="text-[10px] text-slate-400">Ask Chinna "Do you want to pick up?"</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={callSettings.askBeforeAnswering}
                    onChange={(e) => {
                      const updated = { askBeforeAnswering: e.target.checked };
                      callManager.updateSettings(updated);
                      setCallSettings((prev) => ({ ...prev, ...updated }));
                    }}
                    className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-slate-700"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PERSISTENT MEMORY */}
        {/* ========================================================================= */}
        {activeTab === 'memory' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-slate-300 font-bold pb-1">
              <span>SAVED MEMORIES FOR CHINNA</span>
              <span className="text-[10px] text-purple-400 font-mono">{memories.length} records</span>
            </div>
            {memories.map((mem) => (
              <div
                key={mem.id}
                className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300 text-xs">{mem.key}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800/60">
                    {mem.category}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">{mem.value}</p>
                <p className="text-[9px] text-slate-500">
                  {new Date(mem.updatedAt).toLocaleDateString()} • {mem.source}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DIAGNOSTIC LOGS */}
        {/* ========================================================================= */}
        {activeTab === 'logs' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-300 pb-1">
              <span className="font-bold">SYSTEM ACTIVITY LOG</span>
              <button
                onClick={onClearLogs}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
            <div className="space-y-1.5 font-mono text-[10px]">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-1.5 rounded bg-slate-950/60 border border-slate-800/70 flex items-start gap-1.5"
                >
                  <span className="text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                  </span>
                  <span
                    className={`font-bold shrink-0 ${
                      log.source === 'MIC'
                        ? 'text-sky-400'
                        : log.source === 'GEMINI'
                        ? 'text-pink-400'
                        : log.source === 'WAKEWORD'
                        ? 'text-purple-400'
                        : log.source === 'VAD'
                        ? 'text-emerald-400'
                        : log.source === 'SYSTEM_CONTROL'
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    [{log.source}]
                  </span>
                  <span
                    className={`break-all ${
                      log.level === 'error'
                        ? 'text-rose-300 font-bold'
                        : log.level === 'warn'
                        ? 'text-amber-300'
                        : log.level === 'success'
                        ? 'text-emerald-300'
                        : 'text-slate-300'
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer System Status */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>MYRAA v1.0 • Chinna Edition</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Reload</span>
        </button>
      </div>
    </aside>
  );
};
