import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Cpu,
  ShieldCheck,
  Zap,
  Trash2,
  RefreshCw,
  Save,
} from 'lucide-react';
import { AISettings, AIProviderType, ProviderTestResult } from '../types';
import { aiRouter } from '../services/ai/AIRouter';
import { aiSettingsStorage } from '../services/ai/AISettingsStorage';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (settings: AISettings) => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const [settings, setSettings] = useState<AISettings>({
    geminiApiKey: '',
    grokApiKey: '',
    preferredProvider: 'gemini',
    automaticFallback: true,
  });

  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGrokKey, setShowGrokKey] = useState(false);

  // Testing states
  const [geminiTest, setGeminiTest] = useState<ProviderTestResult | null>(null);
  const [grokTest, setGrokTest] = useState<ProviderTestResult | null>(null);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isTestingGrok, setIsTestingGrok] = useState(false);

  // Save feedback
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [autoSavedNotice, setAutoSavedNotice] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = aiRouter.getSettings();
      setSettings(current);
      setGeminiTest(null);
      setGrokTest(null);
      setSavedSuccess(false);
      setAutoSavedNotice(null);

      // Trigger sync with server in case keys were saved in another session
      aiRouter.syncWithServer().then((synced) => {
        setSettings(synced);
      }).catch(() => {});

      // Subscribe to any live updates
      const unsubscribe = aiRouter.subscribeSettings((newSettings) => {
        setSettings(newSettings);
      });

      return () => {
        unsubscribe();
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-save helper with debouncing
  const triggerAutoSave = (updated: Partial<AISettings>, noticeText?: string) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      aiRouter.updateSettings(updated);
      if (noticeText) {
        setAutoSavedNotice(noticeText);
        setTimeout(() => setAutoSavedNotice(null), 2500);
      }
    }, 400);
  };

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiTest(null);
    // Ensure the key is saved before testing
    if (settings.geminiApiKey) {
      aiRouter.updateSettings({ geminiApiKey: settings.geminiApiKey });
    }
    try {
      const res = await aiRouter.testProvider('gemini', settings.geminiApiKey || undefined);
      setGeminiTest(res);
    } catch (err: any) {
      setGeminiTest({
        provider: 'gemini',
        success: false,
        message: 'Gemini connection failed',
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleTestGrok = async () => {
    setIsTestingGrok(true);
    setGrokTest(null);
    // Ensure the key is saved before testing
    if (settings.grokApiKey) {
      aiRouter.updateSettings({ grokApiKey: settings.grokApiKey });
    }
    try {
      const res = await aiRouter.testProvider('grok', settings.grokApiKey || undefined);
      setGrokTest(res);
    } catch (err: any) {
      setGrokTest({
        provider: 'grok',
        success: false,
        message: 'Grok connection failed',
      });
    } finally {
      setIsTestingGrok(false);
    }
  };

  const handleDeleteGeminiKey = () => {
    aiRouter.clearKey('gemini');
    setSettings((s) => ({ ...s, geminiApiKey: '' }));
    setGeminiTest(null);
    setAutoSavedNotice('Gemini API key deleted');
    setTimeout(() => setAutoSavedNotice(null), 2500);
  };

  const handleDeleteGrokKey = () => {
    aiRouter.clearKey('grok');
    setSettings((s) => ({ ...s, grokApiKey: '' }));
    setGrokTest(null);
    setAutoSavedNotice('Grok API key deleted');
    setTimeout(() => setAutoSavedNotice(null), 2500);
  };

  const handleSave = () => {
    const saved = aiRouter.updateSettings(settings);
    setSavedSuccess(true);
    if (onSettingsSaved) {
      onSettingsSaved(saved);
    }
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div
      id="ai-api-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md transition-all animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="ai-api-settings-card"
        className="relative w-full max-w-xl bg-slate-900/95 border border-purple-800/50 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-purple-950/50 backdrop-blur-xl text-white overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-md shadow-purple-900/40">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                AI API SETTINGS
              </h2>
              <p className="text-xs text-slate-400">
                Configure external AI providers for MYRAA
              </p>
            </div>
          </div>
          <button
            id="btn-close-ai-settings"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-xs sm:text-sm">
          {/* Section 1: Preferred Provider */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/70 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-semibold text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Preferred AI Provider
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select which AI model MYRAA uses as primary for conversations
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                id="btn-select-provider-gemini"
                type="button"
                onClick={() => setSettings((s) => ({ ...s, preferredProvider: 'gemini' }))}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  settings.preferredProvider === 'gemini'
                    ? 'bg-purple-600/30 text-purple-200 border-purple-500 shadow-md shadow-purple-900/30'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    settings.preferredProvider === 'gemini' ? 'bg-purple-400' : 'bg-slate-600'
                  }`}
                />
                Gemini API
              </button>

              <button
                id="btn-select-provider-grok"
                type="button"
                onClick={() => setSettings((s) => ({ ...s, preferredProvider: 'grok' }))}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  settings.preferredProvider === 'grok'
                    ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500 shadow-md shadow-indigo-900/30'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    settings.preferredProvider === 'grok' ? 'bg-indigo-400' : 'bg-slate-600'
                  }`}
                />
                Grok (xAI) / Groq LPU
              </button>
            </div>
          </div>

          {/* Section 2: Gemini API Key */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-purple-400" />
                Gemini API Key
              </label>
              {settings.geminiApiKey ? (
                <span className="text-[10px] font-medium tracking-wide px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/70 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Saved &amp; Persistent
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-400">
                  Not configured
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                id="input-gemini-key"
                type={showGeminiKey ? 'text' : 'password'}
                value={settings.geminiApiKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings((s) => ({ ...s, geminiApiKey: val }));
                  triggerAutoSave({ geminiApiKey: val }, val ? 'Gemini key saved' : undefined);
                }}
                onBlur={() => {
                  if (settings.geminiApiKey) {
                    aiRouter.updateSettings({ geminiApiKey: settings.geminiApiKey });
                    setAutoSavedNotice('Gemini key saved persistently');
                    setTimeout(() => setAutoSavedNotice(null), 2000);
                  }
                }}
                placeholder="Enter Gemini API key (e.g. AIzaSy...)"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-20 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {settings.geminiApiKey && (
                  <button
                    id="btn-clear-gemini-key"
                    type="button"
                    onClick={handleDeleteGeminiKey}
                    title="Delete and remove Gemini key"
                    className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  id="btn-toggle-show-gemini-key"
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  title={showGeminiKey ? 'Hide key' : 'Show key'}
                  className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showGeminiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Test Gemini Button & Result */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                id="btn-test-gemini"
                type="button"
                onClick={handleTestGemini}
                disabled={isTestingGemini}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
              >
                {isTestingGemini ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    Testing Gemini...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                    Test Gemini
                  </>
                )}
              </button>

              {geminiTest && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    geminiTest.success
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                      : 'bg-rose-950/60 text-rose-300 border-rose-800/80'
                  }`}
                >
                  {geminiTest.success ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>✓ Gemini connected {geminiTest.latencyMs ? `(${geminiTest.latencyMs}ms)` : ''}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>✕ {geminiTest.message}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Grok / Groq API Key */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                Grok (xAI) / Groq API Key
              </label>
              {settings.grokApiKey ? (
                <span className="text-[10px] font-medium tracking-wide px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/70 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Saved &amp; Persistent
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-400">
                  Not configured
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                id="input-grok-key"
                type={showGrokKey ? 'text' : 'password'}
                value={settings.grokApiKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings((s) => ({ ...s, grokApiKey: val }));
                  triggerAutoSave({ grokApiKey: val }, val ? 'Key saved' : undefined);
                }}
                onBlur={() => {
                  if (settings.grokApiKey) {
                    aiRouter.updateSettings({ grokApiKey: settings.grokApiKey });
                    setAutoSavedNotice('Key saved persistently');
                    setTimeout(() => setAutoSavedNotice(null), 2000);
                  }
                }}
                placeholder="Enter Grok key (xai-...) or Groq key (gsk_...)"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-20 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {settings.grokApiKey && (
                  <button
                    id="btn-clear-grok-key"
                    type="button"
                    onClick={handleDeleteGrokKey}
                    title="Delete and remove key"
                    className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  id="btn-toggle-show-grok-key"
                  type="button"
                  onClick={() => setShowGrokKey(!showGrokKey)}
                  title={showGrokKey ? 'Hide key' : 'Show key'}
                  className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showGrokKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Test Grok Button & Result */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                id="btn-test-grok"
                type="button"
                onClick={handleTestGrok}
                disabled={isTestingGrok}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
              >
                {isTestingGrok ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                    Test Connection
                  </>
                )}
              </button>

              {grokTest && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    grokTest.success
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                      : 'bg-rose-950/60 text-rose-300 border-rose-800/80'
                  }`}
                >
                  {grokTest.success ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>✓ {grokTest.message || 'Connected'} {grokTest.latencyMs ? `(${grokTest.latencyMs}ms)` : ''}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>✕ {grokTest.message}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Automatic Fallback */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/70 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <label className="font-semibold text-slate-200 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Automatic Fallback
              </label>
              <p className="text-xs text-slate-400">
                Automatically retry with the secondary provider if the primary provider hits rate limits, quotas, or outages
              </p>
            </div>
            <button
              id="btn-toggle-auto-fallback"
              type="button"
              onClick={() => {
                const nextVal = !settings.automaticFallback;
                setSettings((s) => ({ ...s, automaticFallback: nextVal }));
                triggerAutoSave({ automaticFallback: nextVal });
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.automaticFallback ? 'bg-purple-600' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.automaticFallback ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Persistent Key Guarantee Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-purple-950/30 border border-purple-900/40 text-purple-200/90 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-emerald-300 font-semibold">Persistent Key Guarantee:</strong> Once entered, your Gemini and Grok API keys remain saved across page refreshes, tab closures, and app restarts until you explicitly delete or replace them.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800/80 pt-4 mt-5 flex items-center justify-between">
          <div className="text-xs">
            {autoSavedNotice && (
              <span className="text-emerald-400 flex items-center gap-1 font-medium transition-all">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {autoSavedNotice}
              </span>
            )}
            {savedSuccess && !autoSavedNotice && (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Settings saved!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-cancel-ai-settings"
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-save-ai-settings"
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/40 transition-all"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
