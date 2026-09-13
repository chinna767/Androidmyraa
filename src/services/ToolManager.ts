/**
 * ToolManager.ts
 * Central Tool & Function Calling Manager for MYRAA.
 * Coordinates Gemini tool declarations, safety evaluations, direct platform execution,
 * natural voice response generation, and telemetry diagnostics.
 */

import { SystemControlResult, ToolInvocationLog, DebugLog } from '../types';
import { systemControlManager } from './SystemControlManager';
import { systemControlSafetyManager } from './SystemControlSafetyManager';
import { callManager } from './call/CallManager';
import { callStateManager } from './call/CallStateManager';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export type ToolLogCallback = (log: Omit<DebugLog, 'id' | 'timestamp'>) => void;

export class ToolManager {
  private static instance: ToolManager | null = null;
  private toolInvocationHistory: ToolInvocationLog[] = [];
  private logCallback: ToolLogCallback | null = null;

  private constructor() {}

  public static getInstance(): ToolManager {
    if (!ToolManager.instance) {
      ToolManager.instance = new ToolManager();
    }
    return ToolManager.instance;
  }

  public setLogCallback(callback: ToolLogCallback): void {
    this.logCallback = callback;
  }

  private log(level: 'info' | 'warn' | 'error' | 'success', source: 'TOOL' | 'SYSTEM_CONTROL' | 'SAFETY', message: string): void {
    if (this.logCallback) {
      this.logCallback({ level, source, message });
    }
  }

  /**
   * Get Gemini FunctionDeclarations for all supported system control tools
   */
  public getFunctionDeclarations(): any[] {
    return [
      {
        name: 'volume_up',
        description: 'Increase the device media playback volume safely.',
        parameters: {
          type: 'OBJECT',
          properties: {
            step: {
              type: 'NUMBER',
              description: 'Optional volume step percentage to increase (default 15).',
            },
          },
        },
      },
      {
        name: 'volume_down',
        description: 'Decrease the device media playback volume safely.',
        parameters: {
          type: 'OBJECT',
          properties: {
            step: {
              type: 'NUMBER',
              description: 'Optional volume step percentage to decrease (default 15).',
            },
          },
        },
      },
      {
        name: 'set_volume',
        description: 'Set device media volume to a specific percentage (0 to 100).',
        parameters: {
          type: 'OBJECT',
          properties: {
            level: {
              type: 'NUMBER',
              description: 'Target volume level percentage from 0 to 100.',
            },
          },
          required: ['level'],
        },
      },
      {
        name: 'brightness_up',
        description: 'Increase the device screen brightness.',
        parameters: {
          type: 'OBJECT',
          properties: {
            step: {
              type: 'NUMBER',
              description: 'Brightness percentage step to increase (default 15).',
            },
          },
        },
      },
      {
        name: 'brightness_down',
        description: 'Decrease or dim the device screen brightness.',
        parameters: {
          type: 'OBJECT',
          properties: {
            step: {
              type: 'NUMBER',
              description: 'Brightness percentage step to decrease (default 15).',
            },
          },
        },
      },
      {
        name: 'set_brightness',
        description: 'Set screen brightness to a specific percentage (10 to 100).',
        parameters: {
          type: 'OBJECT',
          properties: {
            level: {
              type: 'NUMBER',
              description: 'Target brightness level percentage from 10 to 100.',
            },
          },
          required: ['level'],
        },
      },
      {
        name: 'torch_on',
        description: 'Turn on the device camera flashlight / torch.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'torch_off',
        description: 'Turn off the device camera flashlight / torch.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'torch_toggle',
        description: 'Toggle the device camera flashlight / torch on or off.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'mobile_data_status',
        description: 'Check whether mobile data / internet connection is currently on.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'mobile_data_on',
        description: 'Request to turn on mobile cellular data.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'mobile_data_off',
        description: 'Request to turn off mobile cellular data.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'get_current_time',
        description: 'Get the exact current local system time and timezone from the device clock.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'get_current_date',
        description: 'Get the exact current date, month, year, and day of the week from the device clock.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'youtube_search',
        description: 'Search for videos or music on YouTube.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'Search terms or song title.',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'youtube_play',
        description: 'Play a song, music video, or specific media query on YouTube.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'Name of the song, artist, or video to play.',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'youtube_pause',
        description: 'Pause the current YouTube or media playback.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'youtube_resume',
        description: 'Resume paused YouTube or media playback.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'youtube_stop',
        description: 'Stop the active YouTube media playback completely.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'go_back',
        description: 'Navigate back to the previous view or page.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'scroll_up',
        description: 'Scroll up the current screen or view.',
        parameters: {
          type: 'OBJECT',
          properties: {
            amount: {
              type: 'NUMBER',
              description: 'Pixels to scroll (default 350).',
            },
          },
        },
      },
      {
        name: 'scroll_down',
        description: 'Scroll down the current screen or view.',
        parameters: {
          type: 'OBJECT',
          properties: {
            amount: {
              type: 'NUMBER',
              description: 'Pixels to scroll (default 350).',
            },
          },
        },
      },
      {
        name: 'call_contact',
        description: 'Initiate a phone call to a saved contact (e.g. Mom, Dad, Rahul, or contact name) on the user Android phone.',
        parameters: {
          type: 'OBJECT',
          properties: {
            contact_name: {
              type: 'STRING',
              description: 'Name or relationship of the contact to call (e.g. "Mom", "Rahul", "Dad", "John").',
            },
          },
          required: ['contact_name'],
        },
      },
      {
        name: 'answer_incoming_call',
        description: 'Answer or accept the active incoming phone call.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'reject_incoming_call',
        description: 'Reject, decline, or ignore the active incoming phone call.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'cancel_pending_call',
        description: 'Cancel a pending outgoing call before dialing.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'get_call_state',
        description: 'Get the current phone call state (IDLE, INCOMING_RINGING, IN_CALL, etc.).',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'get_incoming_caller',
        description: 'Get details about the active incoming caller.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'get_recent_call_status',
        description: 'Get information about recent incoming, outgoing, or missed calls.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
    ];
  }

  /**
   * Execute a tool by name with arguments
   */
  public async executeTool(toolName: string, args: any = {}): Promise<{ result: SystemControlResult; naturalResponse: string }> {
    const startTime = performance.now();
    const logId = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.log('info', 'TOOL', `Tool requested: [${toolName}] with args ${JSON.stringify(args)}`);

    // 1. Safety & Permission Check
    const safety = systemControlSafetyManager.evaluateSafety(toolName, args);
    if (!safety.allowed && safety.requiresConfirmation) {
      this.log('warn', 'SAFETY', `Action [${toolName}] requires confirmation. Reason: ${safety.reason}`);
      const confirmationMsg = safety.confirmationPrompt || `Are you sure you want me to perform ${toolName}, Chinna?`;
      const result: SystemControlResult = {
        success: false,
        action: toolName,
        message: confirmationMsg,
        requiresConfirmation: true,
      };
      this.recordInvocation({
        id: logId,
        timestamp: new Date().toISOString(),
        toolName,
        args,
        arguments: args,
        status: 'REQUESTED',
        result,
        executionTimeMs: Math.round(performance.now() - startTime),
      });
      return { result, naturalResponse: confirmationMsg };
    }

    // 2. Dispatch to SystemControlManager
    this.log('info', 'SYSTEM_CONTROL', `Executing real platform tool: ${toolName}`);
    let result: SystemControlResult;

    try {
      switch (toolName) {
        case 'volume_up':
          result = systemControlManager.volume_up(args.step || 15);
          break;
        case 'volume_down':
          result = systemControlManager.volume_down(args.step || 15);
          break;
        case 'set_volume':
          result = systemControlManager.set_volume(typeof args.level === 'number' ? args.level : 50);
          break;
        case 'brightness_up':
          result = systemControlManager.brightness_up(args.step || 15);
          break;
        case 'brightness_down':
          result = systemControlManager.brightness_down(args.step || 15);
          break;
        case 'set_brightness':
          result = systemControlManager.set_brightness(typeof args.level === 'number' ? args.level : 70);
          break;
        case 'torch_on':
          result = await systemControlManager.torch_on();
          break;
        case 'torch_off':
          result = systemControlManager.torch_off();
          break;
        case 'torch_toggle':
          result = await systemControlManager.torch_toggle();
          break;
        case 'mobile_data_status':
          result = systemControlManager.mobile_data_status();
          break;
        case 'mobile_data_on':
          result = systemControlManager.mobile_data_on();
          break;
        case 'mobile_data_off':
          result = systemControlManager.mobile_data_off();
          break;
        case 'get_current_time':
          result = systemControlManager.get_current_time();
          break;
        case 'get_current_date':
          result = systemControlManager.get_current_date();
          break;
        case 'youtube_search':
          result = systemControlManager.youtube_search(args.query || 'music');
          break;
        case 'youtube_play':
          result = systemControlManager.youtube_play(args.query || 'music');
          break;
        case 'youtube_pause':
          result = systemControlManager.youtube_pause();
          break;
        case 'youtube_resume':
          result = systemControlManager.youtube_resume();
          break;
        case 'youtube_stop':
          result = systemControlManager.youtube_stop();
          break;
        case 'go_back':
          result = systemControlManager.go_back();
          break;
        case 'scroll_up':
          result = systemControlManager.scroll_up(args.amount || 350);
          break;
        case 'scroll_down':
          result = systemControlManager.scroll_down(args.amount || 350);
          break;
        case 'call_contact': {
          const callRes = await callManager.callContact(args.contact_name || '');
          result = {
            success: callRes.status === 'CALL_STARTED' || callRes.status === 'AMBIGUOUS_CONTACT' || callRes.requiresConfirmation === true,
            action: 'call_contact',
            message: callRes.naturalResponse,
            current_state: callRes.status,
            requiresConfirmation: callRes.requiresConfirmation,
          };
          break;
        }
        case 'answer_incoming_call': {
          const ansRes = await callManager.answerIncomingCall();
          result = {
            success: ansRes.status === 'CALL_ANSWERED',
            action: 'answer_incoming_call',
            message: ansRes.naturalResponse,
            current_state: ansRes.status,
          };
          break;
        }
        case 'reject_incoming_call': {
          const rejRes = await callManager.rejectIncomingCall();
          result = {
            success: rejRes.status === 'CALL_REJECTED',
            action: 'reject_incoming_call',
            message: rejRes.naturalResponse,
            current_state: rejRes.status,
          };
          break;
        }
        case 'confirm_pending_call': {
          const confRes = await callManager.confirmPendingCall();
          result = {
            success: confRes.status === 'CALL_STARTED',
            action: 'confirm_pending_call',
            message: confRes.naturalResponse,
            current_state: confRes.status,
          };
          break;
        }
        case 'cancel_pending_call': {
          const cancRes = callManager.cancelPendingCall();
          result = {
            success: true,
            action: 'cancel_pending_call',
            message: cancRes.naturalResponse,
            current_state: cancRes.status,
          };
          break;
        }
        case 'get_call_state': {
          const st = callManager.getCallState();
          result = {
            success: true,
            action: 'get_call_state',
            message: `Call state is ${st.state}`,
            current_state: st,
          };
          break;
        }
        case 'get_incoming_caller': {
          const clr = callManager.getIncomingCaller();
          result = {
            success: !!clr,
            action: 'get_incoming_caller',
            message: clr ? `Incoming caller: ${clr.callerName || 'Unknown'}` : 'No active incoming call',
            current_state: clr,
          };
          break;
        }
        case 'get_recent_call_status': {
          const rec = callManager.getRecentCallStatus();
          result = {
            success: true,
            action: 'get_recent_call_status',
            message: rec.summary,
            current_state: rec,
          };
          break;
        }
        case 'clarification':
          result = {
            success: true,
            action: 'clarification',
            message: args.question || 'Volume or brightness, Chinna?',
          };
          break;
        default:
          result = {
            success: false,
            action: toolName,
            message: `Unrecognized system control tool: ${toolName}`,
            error: 'UNKNOWN_TOOL',
          };
      }
    } catch (err: any) {
      result = {
        success: false,
        action: toolName,
        message: `Failed to execute ${toolName}: ${err.message}`,
        error: err.message,
      };
    }

    const execTime = Math.round(performance.now() - startTime);
    result.executionTimeMs = execTime;

    // 3. Formulate Natural Voice Response in MYRAA's personality
    const naturalResponse = toolName === 'clarification'
      ? (args.question || 'Volume or brightness, Chinna?')
      : this.generateNaturalResponse(toolName, args, result);
    this.log(
      result.success ? 'success' : 'warn',
      'SYSTEM_CONTROL',
      `Tool [${toolName}] finished in ${execTime}ms: ${result.message}`
    );

    this.recordInvocation({
      id: logId,
      timestamp: new Date().toISOString(),
      toolName,
      args,
      arguments: args,
      status: result.success ? 'SUCCESS' : result.limitation === 'NATIVE_ANDROID_REQUIRED' ? 'RESTRICTED' : 'ERROR',
      result,
      executionTimeMs: execTime,
    });

    return { result, naturalResponse };
  }

  /**
   * Generate sweet, melodic, girlfriend-like response for Chinna
   */
  private generateNaturalResponse(toolName: string, args: any, result: SystemControlResult): string {
    if (!result.success) {
      if (result.limitation === 'NATIVE_ANDROID_REQUIRED') {
        return "Mobile data can't be changed directly from inside the browser, Chinna, but I can help open your network settings.";
      }
      if (result.limitation === 'TORCH_HARDWARE_UNAVAILABLE') {
        return "Flashlight hardware isn't available on this camera, Chinna.";
      }
      return `I couldn't complete that right now, Chinna: ${result.message}`;
    }

    switch (toolName) {
      case 'volume_up':
        return `Sure! Turning the volume up to ${result.current_state}%, Chinna.`;
      case 'volume_down':
        return `Okay, turned the volume down to ${result.current_state}%, Chinna.`;
      case 'set_volume':
        return `Done, Chinna! Volume is set to ${result.current_state}%.`;
      case 'brightness_up':
        return `Okay, made the screen brighter for you, Chinna! (${result.current_state}%)`;
      case 'brightness_down':
        return `Sure, dimmed the screen to ${result.current_state}%, Chinna.`;
      case 'set_brightness':
        return `Brightness set to ${result.current_state}%, Chinna!`;
      case 'torch_on':
        return 'Flashlight is on, Chinna!';
      case 'torch_off':
        return 'Turned the flashlight off, Chinna.';
      case 'torch_toggle':
        return result.current_state ? 'Flashlight is on, Chinna!' : 'Flashlight is off, Chinna.';
      case 'get_current_time':
        return `It's ${result.current_state?.time}, Chinna.`;
      case 'get_current_date':
        return `Today is ${result.current_state?.formatted || 'today'}, Chinna!`;
      case 'mobile_data_status':
        return result.current_state?.isOnline
          ? `Your device is connected and online, Chinna! (${result.current_state.details})`
          : 'Your device is currently offline, Chinna.';
      case 'youtube_play':
        return `Sure, playing ${args.query || 'music'} on YouTube for you, Chinna!`;
      case 'youtube_search':
        return `Searching YouTube for "${args.query || 'music'}", Chinna.`;
      case 'youtube_pause':
        return 'Paused the music for you, Chinna.';
      case 'youtube_resume':
        return 'Resuming playback, Chinna!';
      case 'youtube_stop':
        return 'Stopped the music, Chinna.';
      case 'go_back':
        return 'Going back, Chinna.';
      case 'scroll_up':
        return 'Scrolled up, Chinna.';
      case 'scroll_down':
        return 'Scrolled down, Chinna.';
      default:
        return result.message || 'Done, Chinna!';
    }
  }

  /**
   * Fast natural-language intent parser for direct voice commands
   */
  public matchVoiceIntent(text: string): { toolName: string; args?: any } | null {
    if (!text || text.trim().length === 0) return null;
    const lower = text.toLowerCase().trim();

    // Ambiguity checks when neither volume nor brightness is specified
    if (/^(?:turn\s*it\s*up|make\s*it\s*higher|increase\s*it|boost\s*it)$/i.test(lower)) {
      return { toolName: 'clarification', args: { question: 'Volume or brightness, Chinna?' } };
    }
    if (/^(?:turn\s*it\s*down|make\s*it\s*lower|decrease\s*it|lower\s*it)$/i.test(lower)) {
      return { toolName: 'clarification', args: { question: 'Volume or brightness, Chinna?' } };
    }

    // Volume
    if (
      /(increase|turn\s*up|raise|boost|louder|make\s*it\s*louder)\s*(the\s*)?volume/i.test(lower) ||
      /^volume\s*up$/i.test(lower) ||
      lower === "it's too quiet" ||
      lower === 'too quiet' ||
      lower === 'make it louder' ||
      lower === 'make sound louder' ||
      lower === 'louder'
    ) {
      return { toolName: 'volume_up' };
    }
    if (
      /(decrease|turn\s*down|lower|quieter|make\s*it\s*quieter)\s*(the\s*)?volume/i.test(lower) ||
      /^volume\s*down$/i.test(lower) ||
      lower === "it's too loud" ||
      lower === 'too loud' ||
      lower === 'turn it down' ||
      lower === 'make it quieter' ||
      lower === 'quieter'
    ) {
      return { toolName: 'volume_down' };
    }
    const volMatch = lower.match(/(?:set|change|adjust)\s*(?:the\s*)?volume\s*(?:to\s*)?(\d+)(?:\s*percent|%)?/i);
    if (volMatch) {
      return { toolName: 'set_volume', args: { level: parseInt(volMatch[1], 10) } };
    }

    // Brightness
    if (
      /(increase|turn\s*up|raise|make\s*(the\s*screen\s*)?brighter|more)\s*(the\s*)?brightness/i.test(lower) ||
      /^brightness\s*up$/i.test(lower) ||
      lower === 'make the screen brighter' ||
      lower === 'make it brighter' ||
      lower === 'screen brighter' ||
      lower === 'brighter screen'
    ) {
      return { toolName: 'brightness_up' };
    }
    if (
      /(decrease|turn\s*down|lower|dim|make\s*(the\s*screen\s*)?dimmer|less)\s*(the\s*)?brightness/i.test(lower) ||
      /^brightness\s*down$/i.test(lower) ||
      lower === 'dim the screen' ||
      lower === 'dim the display' ||
      lower === "it's too bright" ||
      lower === 'too bright' ||
      lower === 'make screen dimmer'
    ) {
      return { toolName: 'brightness_down' };
    }
    const brightMatch = lower.match(/(?:set|change|adjust)\s*(?:the\s*)?brightness\s*(?:to\s*)?(\d+)(?:\s*percent|%)?/i);
    if (brightMatch) {
      return { toolName: 'set_brightness', args: { level: parseInt(brightMatch[1], 10) } };
    }

    // Torch
    if (
      /(turn\s*on|switch\s*on|start|enable|light\s*up)\s*(the\s*)?(torch|flashlight)/i.test(lower) ||
      lower === 'torch on' ||
      lower === 'flashlight on' ||
      lower === 'switch the flashlight on' ||
      lower === 'turn on the torch'
    ) {
      return { toolName: 'torch_on' };
    }
    if (
      /(turn\s*off|switch\s*off|kill|stop|disable)\s*(the\s*)?(torch|flashlight)/i.test(lower) ||
      lower === 'torch off' ||
      lower === 'flashlight off' ||
      lower === 'kill the flashlight' ||
      lower === 'switch the flashlight off' ||
      lower === 'turn off the torch'
    ) {
      return { toolName: 'torch_off' };
    }
    if (lower === 'toggle torch' || lower === 'toggle flashlight') {
      return { toolName: 'torch_toggle' };
    }

    // Mobile Data
    if (/(?:is\s*mobile\s*data\s*on|mobile\s*data\s*status|check\s*mobile\s*data|mobile\s*data\s*state|network\s*status)/i.test(lower)) {
      return { toolName: 'mobile_data_status' };
    }
    if (/(?:turn\s*on|enable|switch\s*on)\s*mobile\s*data/i.test(lower)) {
      return { toolName: 'mobile_data_on' };
    }
    if (/(?:turn\s*off|disable|switch\s*off)\s*mobile\s*data/i.test(lower)) {
      return { toolName: 'mobile_data_off' };
    }

    // Time
    if (
      /(?:what\s*time\s*is\s*it|what\s*is\s*the\s*time|what's\s*the\s*time|tell\s*me\s*the\s*(?:current\s*)?time|current\s*time|time\s*please)/i.test(lower)
    ) {
      return { toolName: 'get_current_time' };
    }

    // Date
    if (
      /(?:what\s*(?:is|'s)\s*today's\s*date|what\s*day\s*is\s*today|what\s*is\s*the\s*date|today's\s*date|tell\s*me\s*the\s*date)/i.test(lower)
    ) {
      return { toolName: 'get_current_date' };
    }

    // YouTube
    const ytPlayMatch = lower.match(/(?:play|listen\s*to)\s+(.+?)\s+(?:on|in)\s+youtube/i);
    if (ytPlayMatch) {
      return { toolName: 'youtube_play', args: { query: ytPlayMatch[1].trim() } };
    }
    if (
      lower.startsWith('play on youtube') ||
      lower === 'play music on youtube' ||
      lower === 'play music' ||
      lower === 'play some music' ||
      lower === 'play some songs'
    ) {
      return { toolName: 'youtube_play', args: { query: 'lofi hip hop chill beats' } };
    }
    if (lower === 'play my favorite song' || lower === 'play our favorite song') {
      return { toolName: 'youtube_play', args: { query: 'favorite melody song' } };
    }
    const ytSearchMatch = lower.match(/(?:search|find|look\s*up)\s+(.+?)\s+(?:on|in)\s+youtube/i);
    if (ytSearchMatch) {
      return { toolName: 'youtube_search', args: { query: ytSearchMatch[1].trim() } };
    }
    if (
      lower === 'pause' ||
      lower === 'pause the music' ||
      lower === 'pause music' ||
      lower === 'pause that' ||
      lower === 'pause video' ||
      lower === 'pause youtube'
    ) {
      return { toolName: 'youtube_pause' };
    }
    if (
      lower === 'resume' ||
      lower === 'resume the music' ||
      lower === 'resume music' ||
      lower === 'continue' ||
      lower === 'continue playing' ||
      lower === 'resume playback'
    ) {
      return { toolName: 'youtube_resume' };
    }
    if (
      lower === 'stop the music' ||
      lower === 'stop music' ||
      lower === 'stop playing music' ||
      lower === 'close youtube' ||
      lower === 'stop youtube'
    ) {
      return { toolName: 'youtube_stop' };
    }

    // Navigation & Scroll
    if (lower === 'go back' || lower === 'back' || lower === 'previous page' || lower === 'go to previous page') {
      return { toolName: 'go_back' };
    }
    if (lower === 'scroll up' || lower === 'go up' || lower === 'page up') {
      return { toolName: 'scroll_up' };
    }
    if (lower === 'scroll down' || lower === 'go down' || lower === 'page down') {
      return { toolName: 'scroll_down' };
    }

    // ==========================================
    // UNIFIED PHONE CALL VOICE INTENT MATCHING
    // ==========================================
    const callState = callStateManager.getState();

    // 1. Context-aware incoming call response
    if (callState === 'WAITING_FOR_USER_DECISION' || callState === 'INCOMING_RINGING') {
      if (
        /^(?:pick\s*up|pick\s*it\s*up|answer|answer\s*it|take\s*it|take\s*the\s*call|accept|accept\s*the\s*call|yes|yeah|sure|yep)$/i.test(lower)
      ) {
        return { toolName: 'answer_incoming_call' };
      }
      if (
        /^(?:don't\s*pick\s*up|dont\s*pick\s*up|reject|reject\s*it|decline|decline\s*it|ignore|ignore\s*it|don't\s*answer|dont\s*answer|no|nope|leave\s*it)$/i.test(lower)
      ) {
        return { toolName: 'reject_incoming_call' };
      }
    }

    // 2. Context-aware outgoing confirmation response
    if (callState === 'OUTGOING_CONFIRMATION') {
      if (/^(?:yes|yeah|yep|sure|call|call\s*now|call\s*her|call\s*him|confirm|go\s*ahead|do\s*it)$/i.test(lower)) {
        return { toolName: 'confirm_pending_call' };
      }
      if (/^(?:no|nope|cancel|cancel\s*it|don't\s*call|dont\s*call|never\s*mind|stop|abort)$/i.test(lower)) {
        return { toolName: 'cancel_pending_call' };
      }
    }

    // 3. Explicit call cancellations
    if (/^(?:cancel\s*the\s*call|cancel\s*call|don't\s*call|dont\s*call|never\s*mind)$/i.test(lower)) {
      return { toolName: 'cancel_pending_call' };
    }

    // 4. Recent & missed calls query
    if (
      /(?:who\s*called\s*me|did\s*i\s*miss\s*any\s*calls|recent\s*calls|missed\s*calls|check\s*(?:my\s*)?missed\s*calls|recent\s*call\s*status)/i.test(lower)
    ) {
      return { toolName: 'get_recent_call_status' };
    }

    // 5. Outgoing Call Commands (with false command protection)
    // False command check: past tense statements like "Mom called me yesterday" or "I called Rahul"
    const isPastTenseStatement =
      /(?:called\s*me|i\s*called|was\s*calling|already\s*called|had\s*called|yesterday|earlier\s*today)/i.test(lower);

    if (!isPastTenseStatement) {
      // Matches "call Mom", "please call Rahul", "can you call Dad", "ring my brother", "phone John"
      const callMatch = lower.match(
        /^(?:please\s+|can\s+you\s+|could\s+you\s+|i\s+want\s+to\s+)?(?:call|ring|phone)\s+(?:my\s+)?(.+?)(?:\s+please)?$/i
      );
      if (callMatch && callMatch[1]) {
        const contactTarget = callMatch[1].trim();
        // Guard against generic words that aren't contact targets (like "me later" or "it a day")
        if (
          contactTarget !== 'me' &&
          contactTarget !== 'it' &&
          contactTarget !== 'it a day' &&
          contactTarget !== 'off' &&
          contactTarget !== 'back'
        ) {
          return { toolName: 'call_contact', args: { contact_name: contactTarget } };
        }
      }
    }

    return null;
  }

  private recordInvocation(log: ToolInvocationLog): void {
    this.toolInvocationHistory.unshift(log);
    if (this.toolInvocationHistory.length > 50) {
      this.toolInvocationHistory.pop();
    }
  }

  public getInvocationHistory(): ToolInvocationLog[] {
    return [...this.toolInvocationHistory];
  }

  public clearHistory(): void {
    this.toolInvocationHistory = [];
  }
}

export const toolManager = ToolManager.getInstance();
