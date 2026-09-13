import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, PhoneCall, PhoneOff, Radio, Sparkles, Send, AlertTriangle } from 'lucide-react';
import { CompanionState, NeuralAudioDiagnostics } from '../types';

interface VoiceControlsProps {
  state: CompanionState;
  isMuted: boolean;
  micEnabled: boolean;
  wakeWordEnabled: boolean;
  diagnostics?: NeuralAudioDiagnostics;
  onStartSession: () => void;
  onStopSession: () => void;
  onToggleMute: () => void;
  onToggleMic: () => void;
  onToggleWakeWord: () => void;
  onEnableMicrophone?: () => void;
  onSendText?: (text: string) => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  state,
  isMuted,
  micEnabled,
  wakeWordEnabled,
  diagnostics,
  onStartSession,
  onStopSession,
  onToggleMute,
  onToggleMic,
  onToggleWakeWord,
  onEnableMicrophone,
  onSendText,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inputText, setInputText] = useState('');

  const isConnected =
    state === 'CONNECTED' ||
    state === 'LISTENING' ||
    state === 'USER_SPEAKING' ||
    state === 'MYRAA_SPEAKING' ||
    state === 'INTERRUPTED' ||
    state === 'SAVING_MEMORY';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText?.(inputText.trim());
    setInputText('');
  };

  const isWakeDetectorRunning =
    diagnostics?.wakeDetectorStatus === 'RUNNING' && diagnostics?.micStatus === 'ACTIVE';
  const isSuspended = diagnostics?.wakeDetectorStatus === 'SUSPENDED';

  return (
    <div id="voice-controls-panel" className="w-full max-w-lg mx-auto flex flex-col items-center gap-4">
      {/* Session State & Status Pill */}
      {isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 text-xs font-mono text-slate-400 bg-slate-900/80 px-4 py-2 rounded-full border border-purple-900/40 backdrop-blur-md shadow-lg"
        >
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            LIVE WITH CHINNA
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-200 font-medium">{formatTime(elapsedSeconds)}</span>
        </motion.div>
      )}

      {state === 'STANDBY' && (
        <div className="flex flex-col items-center gap-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 sm:gap-3 text-xs font-mono px-4 py-2 rounded-full border backdrop-blur-md shadow-lg transition-all ${
              !micEnabled
                ? 'text-rose-300 bg-rose-950/80 border-rose-800/60 shadow-rose-950/30'
                : isWakeDetectorRunning
                ? 'text-sky-300 bg-sky-950/80 border-sky-800/60 shadow-sky-950/30'
                : isSuspended
                ? 'text-amber-300 bg-amber-950/80 border-amber-800/60 shadow-amber-950/30'
                : diagnostics?.micStatus === 'PERMISSION_DENIED'
                ? 'text-amber-300 bg-amber-950/80 border-amber-800/60 shadow-amber-950/30'
                : 'text-purple-300 bg-purple-950/80 border-purple-800/60 shadow-purple-950/30'
            }`}
          >
            <span
              className={`flex items-center gap-1.5 font-semibold ${
                !micEnabled
                  ? 'text-rose-400'
                  : isWakeDetectorRunning
                  ? 'text-sky-400'
                  : isSuspended
                  ? 'text-amber-400'
                  : diagnostics?.micStatus === 'PERMISSION_DENIED'
                  ? 'text-amber-400'
                  : 'text-purple-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !micEnabled
                    ? 'bg-rose-500'
                    : isWakeDetectorRunning
                    ? 'bg-sky-400 animate-pulse'
                    : isSuspended
                    ? 'bg-amber-400'
                    : diagnostics?.micStatus === 'PERMISSION_DENIED'
                    ? 'bg-amber-400'
                    : 'bg-purple-400'
                }`}
              />
              {!micEnabled ? 'MYRAA • MIC OFF' : 'MYRAA • STANDBY'}
            </span>
            <span className="text-slate-700">|</span>
            {!micEnabled ? (
              <span className="text-slate-400">Microphone paused in system pipeline</span>
            ) : isWakeDetectorRunning ? (
              <span className="text-sky-200 font-medium">Say &quot;Myraa&quot; to wake me</span>
            ) : isSuspended ? (
              <span className="text-amber-200 font-medium flex items-center gap-1">
                Wake detector suspended (Tab backgrounded)
              </span>
            ) : diagnostics?.micStatus === 'PERMISSION_DENIED' ? (
              <button
                onClick={onEnableMicrophone || onStartSession}
                className="text-amber-200 hover:text-amber-100 underline decoration-amber-400 font-medium cursor-pointer transition-colors"
              >
                Microphone permission needed (Click to allow)
              </button>
            ) : (
              <button
                onClick={onEnableMicrophone || onStartSession}
                className="text-purple-200 hover:text-purple-100 underline decoration-purple-400 font-medium cursor-pointer transition-colors"
              >
                Click to start voice session
              </button>
            )}
          </motion.div>

          {micEnabled && diagnostics?.micStatus === 'PERMISSION_DENIED' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-800/80 text-[11px] text-amber-300 font-sans"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Please grant microphone permission in your browser to talk with MYRAA.</span>
              <button
                onClick={onEnableMicrophone || onStartSession}
                className="ml-1 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-[10px] transition-colors"
              >
                Grant Access
              </button>
            </motion.div>
          )}
        </div>
      )}

      {diagnostics?.browserLimitation && (
        <div className="w-full text-center text-[10px] font-mono text-amber-400/90 bg-amber-950/50 border border-amber-900/60 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0 text-amber-400" />
          <span>{diagnostics.browserLimitation}</span>
        </div>
      )}

      {state === 'CONNECTING' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 text-xs font-mono text-purple-300 bg-purple-950/80 px-4 py-2 rounded-full border border-purple-800/60 backdrop-blur-md shadow-lg"
        >
          <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-spin" />
            CONNECTING TO MYRAA...
          </span>
        </motion.div>
      )}

      {/* Quick Input Bar */}
      <form onSubmit={handleTextSubmit} className="w-full relative flex items-center">
        <input
          type="text"
          placeholder="Speak naturally or type (e.g. 'Remember that I'm building MYRAA')..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="w-full bg-slate-950/70 border border-slate-800 focus:border-purple-500/60 rounded-xl pl-4 pr-11 py-2.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none backdrop-blur-md shadow-inner transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="absolute right-2 p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:hover:bg-purple-600 transition-colors shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Main Action Button Group */}
      <div className="flex items-center justify-center gap-3 w-full">
        {/* Mute / Unmute Button */}
        {isConnected && (
          <motion.button
            id="btn-toggle-mute"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`p-2.5 rounded-xl border transition-all duration-200 shadow-md ${
              isMuted
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-slate-900/80 text-slate-200 border-slate-700 hover:bg-slate-800'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </motion.button>
        )}

        {/* Primary Start / Stop Conversation Button */}
        {!isConnected ? (
          <motion.button
            id="btn-start-conversation"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStartSession}
            disabled={state === 'CONNECTING'}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-medium text-sm shadow-lg shadow-purple-950/40 transition-all duration-300 disabled:opacity-50 min-w-[160px]"
          >
            {state === 'CONNECTING' ? (
              <>
                <Radio className="w-4 h-4 animate-spin text-purple-200" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <PhoneCall className="w-4 h-4 text-white" />
                <span>Talk with MYRAA</span>
              </>
            )}
          </motion.button>
        ) : (
          <motion.button
            id="btn-stop-conversation"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStopSession}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm shadow-lg shadow-rose-950/40 transition-all duration-300 min-w-[140px]"
          >
            <PhoneOff className="w-4 h-4 text-white" />
            <span>End Call</span>
          </motion.button>
        )}

        {/* Wake Word Mode Toggle */}
        <motion.button
          id="btn-toggle-wakeword"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleWakeWord}
          title={wakeWordEnabled ? 'Wake word "Myraa" active' : 'Wake word inactive'}
          aria-label="Toggle Myraa wake word"
          className={`p-2.5 rounded-xl border transition-all duration-200 shadow-md ${
            wakeWordEnabled
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 hover:bg-purple-500/30'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
};
