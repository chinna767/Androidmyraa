export type CompanionState =
  | 'DISCONNECTED'
  | 'STANDBY' // Waiting for local single wake word "Myraa"
  | 'CONNECTING'
  | 'CONNECTED'
  | 'LISTENING'
  | 'USER_SPEAKING'
  | 'MYRAA_SPEAKING'
  | 'INTERRUPTED'
  | 'SAVING_MEMORY'
  | 'ERROR';

export type MemoryCategory =
  | 'IDENTITY'
  | 'PREFERENCES'
  | 'INTERESTS'
  | 'GOALS'
  | 'PROJECTS'
  | 'HABITS'
  | 'RELATIONSHIPS'
  | 'LIFE_EVENTS'
  | 'CONVERSATIONAL_PREFERENCES'
  // Backward-compatible category aliases:
  | 'Preference'
  | 'Goal'
  | 'Project'
  | 'Habit'
  | 'Schedule'
  | 'Relationship'
  | 'Interest'
  | 'Important Fact'
  | 'Conversation'
  | 'Instruction'
  | 'Personal Detail';

export type MemorySource = 'EXPLICIT' | 'AUTOMATIC' | 'SYSTEM' | 'explicit' | 'inferred' | 'manual';
export type MemoryStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
export type MemorySensitivity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface MemoryEntity {
  memoryId: string;
  id?: string; // alias for backward-compatibility
  category: MemoryCategory;
  key: string;
  value: string;
  normalizedValue: string;
  importance: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  createdAt: string; // ISO-8601 string
  updatedAt: string; // ISO-8601 string
  lastAccessedAt: string; // ISO-8601 string
  accessCount: number;
  source: MemorySource;
  status: MemoryStatus;
  expirationAt?: string; // ISO-8601 string for temporary memories
  sensitivity: MemorySensitivity;
  version: number;
}

// Backward-compatible alias for existing code
export type MemoryRecord = MemoryEntity;

export type MemoryEventType =
  | 'MemoryCandidateDetected'
  | 'MemorySaved'
  | 'MemoryUpdated'
  | 'MemoryRetrieved'
  | 'MemoryForgotten'
  | 'MemoryExpired'
  | 'MemoryConflictDetected'
  | 'MemorySaveFailed'
  | 'MemoryValidated'
  | 'MemoryPrivacyBlocked';

export interface MemoryEvent {
  id: string;
  type: MemoryEventType;
  timestamp: string;
  memoryId?: string;
  key?: string;
  details: string;
  data?: any;
}

export interface MemoryCandidate {
  category: MemoryCategory;
  key: string;
  value: string;
  normalizedValue: string;
  rawStatement: string;
  importance: number;
  confidence: number;
  source: MemorySource;
  expirationAt?: string;
  sensitivity: MemorySensitivity;
  isExplicit: boolean;
}

export interface MemoryDiagnostics {
  totalMemories: number;
  activeMemories: number;
  expiredMemories: number;
  lastRetrievedCount: number;
  lastSavedMemory?: string;
  databaseStatus: 'READY' | 'SYNCHRONIZED' | 'WRITING' | 'ERROR';
  storageEngine: 'IndexedDB+LocalStorage' | 'RoomSQLite';
  lastOperationLatencyMs: number;
}

export interface EmotionalState {
  happiness: number; // 0.0 to 1.0
  curiosity: number;
  excitement: number;
  concern: number;
  affection: number;
  confidence: number;
  empathy: number;
  energy: number;
  dominantMood: string;
}

export interface AudioTrackDiagnostics {
  audioTrackState: 'running' | 'suspended' | 'closed' | 'initializing';
  audioStreamType: string;
  sampleRate: number;
  channelCount: number;
  pcmEncoding: string;
  bufferSize: number;
  applicationGain: number;
  systemStreamVolume: string;
  systemStreamMaxVolume: string;
  peakOutputDb: number;
}

export interface AudioMetrics {
  micLevel: number; // 0 to 1
  outputLevel: number; // 0 to 1
  inputDb: number;
  outputDb: number;
  bufferQueueSize: number;
  chunksReceived: number;
  chunksSent: number;
  latencyMs: number;
  audioTrackDiagnostics?: AudioTrackDiagnostics;
}

export interface WakeWordPipelineTelemetry {
  // AUDIO INPUT
  audioContextSampleRate: number;
  micSampleRate: number;
  channelCount: number;
  isMono: boolean;
  bufferSize: number;
  rawRms: number;
  peakAmplitude: number;
  averageAmplitude: number;

  // AUDIO PROCESSING
  inputSampleRate: number;
  targetSampleRate: number;
  resampledSampleRate: number;
  numSamples: number;
  pcmRange: string;
  minPcm: number;
  maxPcm: number;
  meanPcm: number;

  // MODEL
  isModelLoaded: boolean;
  modelInputShape: number[];
  modelInputDataType: string;
  expectedFeatureShape: number[];
  actualFeatureShape: number[];
  modelOutputShape: number[];
  numOutputClasses: number;
  classLabels: string[];

  // FEATURE HEALTH
  featureMin: number;
  featureMax: number;
  featureMean: number;
  featureVariance: number;

  // INFERENCE
  rawOutputValues: number[];
  outputProbabilities: number[];
  highestProbability: number;
  highestProbabilityClassIndex: number;
  highestProbabilityClassLabel: string;
  wakeWordClassIndex: number;
  wakeWordConfidence: number;
  smoothedConfidence?: number;
  consecutiveDetections?: number;
  wakeDecision?: 'WAKE ACCEPTED' | 'REJECTED' | 'LISTENING';
  rejectionReason?: string;
  targetPhrase?: string;
}

export interface NeuralAudioDiagnostics {
  wakeWordState: 'READY' | 'DETECTED' | 'STANDBY' | 'OFF';
  wakeDetectorStatus: 'RUNNING' | 'STOPPED' | 'SUSPENDED' | 'UNAVAILABLE';
  micStatus: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PERMISSION_DENIED';
  modelStatus: 'READY' | 'ERROR' | 'UNAVAILABLE';
  modelName: string;
  isMyraaClassTrained: boolean;
  modelLimitationNotice?: string;
  lastInferenceTimestamp?: string;
  wakeWordConfidence: number; // 0.0 to 1.0 (actual value)
  wakeWordThreshold: number; // e.g. 0.75
  vadState: 'SPEECH' | 'SILENCE' | 'STANDBY';
  vadProbability: number; // 0.0 to 1.0
  vadThreshold: number; // e.g. 0.58
  tensorFlowStatus: 'READY' | 'RUNNING' | 'STANDBY' | 'ERROR' | 'INITIALIZING';
  tensorFlowBackend: string;
  geminiStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
  audioState: 'ACTIVE' | 'IDLE' | 'INTERRUPTED' | 'STANDBY';
  inferenceLatencyMs: number;
  interruptionCount: number;
  lastBargeInTimestamp?: string;
  browserLimitation?: string;
  isBrowserThrottled?: boolean;
  framesReceivedInStandby?: number;
  wakeWordTelemetry?: WakeWordPipelineTelemetry;
}

export interface DebugLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source:
    | 'SYSTEM'
    | 'MIC'
    | 'AUDIO_OUT'
    | 'WEBSOCKET'
    | 'GEMINI'
    | 'GROK'
    | 'AI_ROUTER'
    | 'AI_FALLBACK'
    | 'MEMORY'
    | 'WAKEWORD'
    | 'EMOTION'
    | 'TFLITE'
    | 'VAD'
    | 'TOOL'
    | 'SYSTEM_CONTROL'
    | 'SAFETY'
    | 'SCREEN'
    | 'VISION'
    | 'CODE_ANALYSIS'
    | 'CALL'
    | 'TELECOM'
    | 'CONTACTS';
}

export type CapabilityStatus = 'available' | 'limited' | 'restricted' | 'unavailable' | 'NATIVE_ANDROID_REQUIRED';

export interface SystemCapabilitiesInfo {
  platform: 'browser' | 'android' | 'electron' | 'unknown';
  userAgent: string;
  isNativeAndroid: boolean;
  osName: string;
  volume_control: CapabilityStatus;
  brightness_control: CapabilityStatus;
  torch_control: CapabilityStatus;
  mobile_data_control: CapabilityStatus;
  time: CapabilityStatus;
  date: CapabilityStatus;
  youtube: CapabilityStatus;
  back: CapabilityStatus;
  scroll: CapabilityStatus;
}

export interface SystemControlResult {
  success: boolean;
  action: string;
  current_state?: any;
  message: string;
  error?: string;
  limitation?: string;
  requiresConfirmation?: boolean;
  executionTimeMs?: number;
  status?: string;
}

export interface ToolInvocationLog {
  id: string;
  timestamp: string;
  toolName: string;
  args?: any;
  arguments?: any;
  status: 'REQUESTED' | 'EXECUTING' | 'SUCCESS' | 'RESTRICTED' | 'ERROR';
  result: SystemControlResult;
  executionTimeMs: number;
}

export interface SystemStateSnapshot {
  volume: {
    level: number;
    isMuted: boolean;
  };
  brightness: {
    level: number;
  };
  torch: {
    isOn: boolean;
    isSimulated: boolean;
  };
  network: {
    online: boolean;
    effectiveType: string;
  };
  youtube: {
    isOpen: boolean;
    isPlaying: boolean;
    query?: string;
    title?: string;
  };
  currentTime: string;
  currentDate: string;
  // Flat properties for backward compatibility
  torchActive?: boolean;
  isOnline?: boolean;
  networkType?: string;
  youtubePlaying?: boolean;
  currentYouTubeTitle?: string;
}

export interface TranscriptItem {
  id: string;
  speaker: 'user' | 'myraa';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ServerToClientMessage {
  type: 'connected' | 'audio' | 'text' | 'transcript' | 'interrupted' | 'turnComplete' | 'error' | 'sessionInfo' | 'memoryAction';
  data?: string; // Base64 audio chunk
  text?: string;
  speaker?: 'user' | 'model' | 'myraa';
  error?: string;
  model?: string;
  sampleRate?: number;
  memoryData?: any;
}

export interface ClientToServerMessage {
  type: 'audio' | 'text' | 'ping' | 'interrupt' | 'initSession' | 'memorySync';
  data?: string; // Base64 PCM audio chunk
  text?: string;
  systemInstruction?: string;
  memories?: MemoryRecord[];
}

export interface ProactiveSuggestion {
  id: string;
  type: 'break' | 'cheer' | 'inquiry' | 'affection';
  text: string;
  timestamp: Date;
}

// ==========================================
// SCREEN INTELLIGENCE & CODE ASSISTANT TYPES
// ==========================================

export type ScreenPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

export interface ScreenAwarenessState {
  enabled: boolean;
  allowAnalysis: boolean;
  permissionStatus: ScreenPermissionStatus;
  isCapturing: boolean;
  isAnalyzing: boolean;
  lastCaptureTimestamp?: string;
  lastAnalysisTimestamp?: string;
  detectedApp?: string;
  screenDebugMode: boolean;
}

export interface ScreenFrameData {
  dataUrl: string; // JPEG Base64 with data:image/jpeg;base64,...
  rawBase64: string; // Pure Base64 data without prefix
  mimeType: string;
  width: number;
  height: number;
  timestamp: number;
  frameHash?: string;
}

export interface CodeAnalysisResult {
  language?: string;
  codeSummary?: string;
  variables?: string[];
  functions?: string[];
  controlFlow?: string;
  inputsOutputs?: string;
  sideEffects?: string;
  dependencies?: string[];
  potentialBugs?: string[];
  predictedOutput?: string;
  changeConsequences?: string;
  isStaticPrediction: boolean; // True for static analysis; distinct from actual runtime execution
}

export interface ErrorAnalysisResult {
  hasError: boolean;
  errorType?: string;
  errorMessage?: string;
  likelyCause?: string;
  problematicSection?: string;
  suggestedFix?: string;
  confidenceLevel?: number;
}

export interface ScreenUnderstandingResult {
  summary: string;
  spokenResponse: string;
  category: 'CODE' | 'ERROR' | 'UI' | 'DOCUMENT' | 'TERMINAL' | 'BROWSER' | 'SETTINGS' | 'GENERAL';
  codeAnalysis?: CodeAnalysisResult;
  errorAnalysis?: ErrorAnalysisResult;
  uiElements?: string[];
  detectedApp?: string;
  confidence: number;
  timestamp: number;
}

export interface ScreenContextSnapshot {
  timestamp: number;
  userQuery: string;
  result: ScreenUnderstandingResult;
  frameHash?: string;
  ttlMs: number;
}

// ==========================================
// UNIFIED PHONE CALL MANAGEMENT TYPES
// ==========================================

export type CallState =
  | 'IDLE'
  | 'INCOMING_RINGING'
  | 'INCOMING_IDENTIFYING'
  | 'WAITING_FOR_USER_DECISION'
  | 'ANSWERING'
  | 'IN_CALL'
  | 'OUTGOING_CONFIRMATION'
  | 'OUTGOING_DIALING'
  | 'CALL_ENDED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ERROR';

export type CallExecutionStatus =
  | 'CALL_STARTED'
  | 'PERMISSION_REQUIRED'
  | 'CONTACT_NOT_FOUND'
  | 'AMBIGUOUS_CONTACT'
  | 'CALL_FAILED'
  | 'CANCELLED'
  | 'NATIVE_PERMISSION_REQUIRED'
  | 'DEFAULT_DIALER_ROLE_REQUIRED'
  | 'PLATFORM_RESTRICTION'
  | 'CALL_ANSWERED'
  | 'CALL_REJECTED';

export interface ContactRecord {
  id: string;
  name: string;
  phoneNumber: string;
  normalizedName: string;
  relationship?: string; // e.g. 'Mom', 'Dad', 'Brother', 'Sister', 'Wife', 'Friend'
  isFavorite?: boolean;
}

export interface CallInfo {
  id: string;
  type: 'incoming' | 'outgoing';
  phoneNumber: string;
  callerName?: string;
  resolvedContact?: ContactRecord;
  timestamp: number;
  durationSeconds?: number;
  state: CallState;
  missed?: boolean;
}

export interface CallManagerSettings {
  confirmOutgoingCalls: boolean; // default true
  askBeforeAnswering: boolean; // default true
  autoMuteAssistantDuringCalls: boolean; // default true
}

export interface CallDiagnostics {
  callState: CallState;
  permissionState: {
    readContacts: boolean;
    callPhone: boolean;
    telecomInCall: boolean;
  };
  telecomCapability: 'FULL_NATIVE' | 'TELECOM_IN_CALL_SERVICE' | 'INTENT_DIALER_ONLY' | 'BROWSER_RESTRICTED' | 'UNAVAILABLE';
  lastCaller?: {
    name?: string;
    maskedNumber: string;
    isUnknown: boolean;
  };
  lastRequestedAction?: string;
  lastExecutionResult?: CallExecutionStatus;
  lastExecutionLatencyMs: number;
  isAssistantAudioSuppressed: boolean;
}

// ==========================================
// AI PROVIDER & MULTI-PROVIDER ROUTER TYPES
// ==========================================

export type AIProviderType = 'gemini' | 'grok';

export interface AISettings {
  geminiApiKey: string;
  grokApiKey: string;
  preferredProvider: AIProviderType;
  automaticFallback: boolean;
}

export interface AIRequest {
  prompt: string;
  systemInstruction?: string;
  voice?: string;
  temperature?: number;
}

export interface AIResponse {
  text: string;
  audio?: string | null;
  providerUsed: AIProviderType;
  fallbackTriggered?: boolean;
  fallbackReason?: string;
}

export interface ProviderTestResult {
  provider: AIProviderType;
  success: boolean;
  message: string;
  latencyMs?: number;
}

