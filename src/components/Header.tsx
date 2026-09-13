import React from 'react';
import { Sparkles, Wifi, Heart, Activity, Cpu } from 'lucide-react';
import { CompanionState, EmotionalState, AIProviderType } from '../types';

interface HeaderProps {
  state: CompanionState;
  emotionalState: EmotionalState;
  isDebugOpen: boolean;
  onToggleDebug: () => void;
  isAISettingsOpen?: boolean;
  onToggleAISettings?: () => void;
  activeProvider?: AIProviderType;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  emotionalState,
  isDebugOpen,
  onToggleDebug,
  isAISettingsOpen = false,
  onToggleAISettings,
  activeProvider = 'gemini',
}) => {
  const isLive =
    state === 'CONNECTED' ||
    state === 'LISTENING' ||
    state === 'USER_SPEAKING' ||
    state === 'MYRAA_SPEAKING' ||
    state === 'INTERRUPTED' ||
    state === 'SAVING_MEMORY';

  return (
    <header id="myraa-header" className="w-full max-w-5xl mx-auto flex items-center justify-between py-4 px-4 sm:px-6">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {isLive && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">MYRAA</h1>
          </div>
          <p className="text-xs text-slate-400">Companion for Chinna</p>
        </div>
      </div>

      {/* Center Emotional Mood Pill */}
      <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/60 border border-purple-900/40 text-xs text-purple-200 backdrop-blur-md shadow-inner">
        <Heart className="w-3.5 h-3.5 text-pink-400 animate-pulse fill-pink-500/30" />
        <span className="font-medium text-slate-300">Mood:</span>
        <span className="font-semibold text-purple-300">{emotionalState.dominantMood}</span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Status Pill */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border backdrop-blur-md transition-all ${
            isLive
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/80 shadow-sm shadow-emerald-900/30'
              : state === 'STANDBY'
              ? 'bg-sky-950/60 text-sky-300 border-sky-700/80'
              : state === 'CONNECTING'
              ? 'bg-purple-950/60 text-purple-300 border-purple-700/80'
              : state === 'ERROR'
              ? 'bg-rose-950/60 text-rose-300 border-rose-700/80'
              : 'bg-slate-900/60 text-slate-400 border-slate-800'
          }`}
        >
          <Wifi className={`w-3.5 h-3.5 ${isLive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
          <span className="hidden xs:inline">
            {isLive ? 'Live' : state === 'STANDBY' ? 'Standby' : state === 'CONNECTING' ? 'Connecting' : 'Offline'}
          </span>
        </div>

        {/* AI API Settings Button */}
        {onToggleAISettings && (
          <button
            id="btn-nav-ai-settings"
            onClick={onToggleAISettings}
            title="AI API Settings (Gemini / Grok)"
            aria-label="Open AI API Settings"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-sm ${
              isAISettingsOpen
                ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/60 shadow-indigo-900/30'
                : 'bg-slate-900/70 text-slate-300 border-slate-800 hover:border-indigo-500/40 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline font-semibold">
              {activeProvider === 'grok' ? 'Grok' : 'Gemini'}
            </span>
          </button>
        )}

        {/* Real-time System & Pipeline Diagnostics Toggle */}
        <button
          id="btn-nav-debug"
          onClick={onToggleDebug}
          title="Real-Time System & Pipeline Telemetry, Diagnostics & Memories"
          aria-label="Open Real-Time System & Pipeline Telemetry"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-sm ${
            isDebugOpen
              ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-purple-900/30'
              : 'bg-slate-900/70 text-slate-300 border-slate-800 hover:border-purple-500/40 hover:text-white'
          }`}
        >
          <Activity className={`w-3.5 h-3.5 ${isLive ? 'text-emerald-400 animate-pulse' : 'text-purple-400'}`} />
          <span className="hidden sm:inline font-semibold">System &amp; Pipeline</span>
        </button>
      </div>
    </header>
  );
};
