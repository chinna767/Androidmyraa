import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

// Persistent file storage path for user AI settings
const SETTINGS_FILE_PATH = path.join(process.cwd(), '.myraa_ai_settings.json');

interface StoredAISettings {
  geminiApiKey?: string;
  grokApiKey?: string;
  preferredProvider?: 'gemini' | 'grok';
  automaticFallback?: boolean;
  updatedAt?: string;
}

function loadServerSettings(): StoredAISettings {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const raw = fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Server] Notice reading stored settings:', err);
  }
  return {};
}

function saveServerSettings(settings: StoredAISettings) {
  try {
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server] Notice writing stored settings:', err);
  }
}

let aiClient: GoogleGenAI | null = null;
let cachedAiKey: string = '';

function getAi(customApiKey?: string): GoogleGenAI {
  const serverSettings = loadServerSettings();
  const key = (customApiKey || serverSettings.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();

  if (!aiClient || cachedAiKey !== key) {
    if (!key) {
      console.warn('[Server] WARNING: Gemini API key is not configured.');
    }
    cachedAiKey = key;
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * Call Grok (xAI) or Groq LPU API with official chat/completions contract
 */
async function callGrok(params: {
  prompt: string;
  systemInstruction?: string;
  apiKey?: string;
  temperature?: number;
}): Promise<string> {
  const serverSettings = loadServerSettings();
  const apiKey = (params.apiKey || serverSettings.grokApiKey || process.env.GROK_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Grok or Groq API key is required. Please configure your key in AI API Settings.');
  }

  const isGroq = apiKey.startsWith('gsk_');
  const endpoint = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.x.ai/v1/chat/completions';
  const model = isGroq ? 'qwen/qwen3.8-27b' : 'grok-2-latest';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            params.systemInstruction ||
            'You are MYRAA, a sweet, warm, melodic AI companion for Chinna. Speak naturally and concisely.',
        },
        {
          role: 'user',
          content: params.prompt,
        },
      ],
      model,
      temperature: params.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg =
      errBody.error?.message ||
      errBody.error ||
      `${isGroq ? 'Groq' : 'Grok'} API returned HTTP status ${response.status}`;
    const err = new Error(errMsg) as any;
    err.status = response.status;
    throw err;
  }

  const data: any = await response.json();
  const text =
    data.choices?.[0]?.message?.content || "I'm right here with you, Chinna.";
  return text;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // 1. Health check endpoint
  app.get('/api/health', (req, res) => {
    const serverSettings = loadServerSettings();
    res.json({
      status: 'ok',
      service: 'MYRAA Real-Time Companion Server',
      timestamp: new Date().toISOString(),
      hasKey: !!(serverSettings.geminiApiKey || process.env.GEMINI_API_KEY),
      hasGrokKey: !!(serverSettings.grokApiKey || process.env.GROK_API_KEY),
      preferredProvider: serverSettings.preferredProvider || 'gemini',
    });
  });

  // Persistent AI Settings API (Ensures keys survive page refreshes, tab close/reopen, and device reloads)
  app.get('/api/ai/settings', (req, res) => {
    const settings = loadServerSettings();
    res.json({
      geminiApiKey: settings.geminiApiKey || '',
      grokApiKey: settings.grokApiKey || '',
      preferredProvider: settings.preferredProvider || 'gemini',
      automaticFallback: settings.automaticFallback !== false,
      hasGeminiKey: !!(settings.geminiApiKey || process.env.GEMINI_API_KEY),
      hasGrokKey: !!(settings.grokApiKey || process.env.GROK_API_KEY),
      updatedAt: settings.updatedAt,
    });
  });

  app.post('/api/ai/settings', (req, res) => {
    const current = loadServerSettings();
    const { geminiApiKey, grokApiKey, preferredProvider, automaticFallback } = req.body;

    const updated: StoredAISettings = {
      ...current,
      geminiApiKey: geminiApiKey !== undefined ? (geminiApiKey ? geminiApiKey.trim() : '') : (current.geminiApiKey || ''),
      grokApiKey: grokApiKey !== undefined ? (grokApiKey ? grokApiKey.trim() : '') : (current.grokApiKey || ''),
      preferredProvider: preferredProvider !== undefined ? preferredProvider : (current.preferredProvider || 'gemini'),
      automaticFallback: automaticFallback !== undefined ? automaticFallback : (current.automaticFallback !== false),
      updatedAt: new Date().toISOString(),
    };

    saveServerSettings(updated);
    console.log('[Server] AI settings persisted to disk. Gemini key set:', !!updated.geminiApiKey, 'Grok key set:', !!updated.grokApiKey);
    res.json({ success: true, settings: updated });
  });

  app.delete('/api/ai/settings/key/:provider', (req, res) => {
    const current = loadServerSettings();
    const { provider } = req.params;
    if (provider === 'gemini') {
      current.geminiApiKey = '';
    } else if (provider === 'grok') {
      current.grokApiKey = '';
    }
    current.updatedAt = new Date().toISOString();
    saveServerSettings(current);
    console.log(`[Server] ${provider} key deleted from persistent storage.`);
    res.json({ success: true, message: `${provider} key deleted` });
  });

  // 2. AI Connection Test Endpoint (for Gemini and Grok)
  app.post('/api/ai/test', async (req, res) => {
    const startTime = Date.now();
    try {
      const serverSettings = loadServerSettings();
      const { provider = 'gemini', apiKey } = req.body;

      if (provider === 'grok') {
        const key = (apiKey || serverSettings.grokApiKey || process.env.GROK_API_KEY || '').trim();
        if (!key) {
          return res.status(400).json({
            success: false,
            error: 'API key is missing. Please enter your Grok or Groq API key.',
          });
        }

        const isGroq = key.startsWith('gsk_');
        const endpoint = isGroq
          ? 'https://api.groq.com/openai/v1/chat/completions'
          : 'https://api.x.ai/v1/chat/completions';
        const model = isGroq ? 'qwen/qwen3.8-27b' : 'grok-2-latest';

        const testRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: 'ping',
              },
            ],
            model,
            max_tokens: 5,
          }),
        });

        if (!testRes.ok) {
          const errData: any = await testRes.json().catch(() => ({}));
          const errMsg =
            errData.error?.message ||
            errData.error ||
            `${isGroq ? 'Groq' : 'Grok'} API returned HTTP status ${testRes.status}`;
          return res.status(testRes.status).json({
            success: false,
            error: errMsg,
            latencyMs: Date.now() - startTime,
          });
        }

        return res.json({
          success: true,
          message: `${isGroq ? 'Groq LPU' : 'Grok'} connected`,
          latencyMs: Date.now() - startTime,
        });
      } else {
        // Test Gemini
        const key = (apiKey || serverSettings.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
        if (!key) {
          return res.status(400).json({
            success: false,
            error: 'Gemini API key is missing. Please enter your Gemini API key.',
          });
        }

        const ai = getAi(key);
        let testText = '';
        try {
          const testRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: 'Say hello in 3 words.',
          });
          testText = testRes.text || '';
        } catch (e: any) {
          const fallbackRes = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: 'Say hello in 3 words.',
          });
          testText = fallbackRes.text || '';
        }

        if (testText) {
          return res.json({
            success: true,
            message: 'Gemini connected',
            latencyMs: Date.now() - startTime,
          });
        } else {
          return res.status(500).json({
            success: false,
            error: 'No response received from Gemini',
            latencyMs: Date.now() - startTime,
          });
        }
      }
    } catch (err: any) {
      console.error('[Server] AI test error:', err.message || err);
      const isRateLimit =
        err.status === 429 ||
        (err.message && err.message.toLowerCase().includes('quota')) ||
        (err.message && err.message.toLowerCase().includes('rate limit'));
      const friendlyError = isRateLimit
        ? 'API rate limit or quota exceeded for this key'
        : err.message || 'Connection test failed';

      return res.status(err.status || 500).json({
        success: false,
        error: friendlyError,
        latencyMs: Date.now() - startTime,
      });
    }
  });

  // 3. High-Fidelity Conversational Multi-Provider REST Voice Endpoint
  app.post('/api/companion/converse', async (req, res) => {
    try {
      const {
        prompt,
        voice = 'Aoede',
        systemInstruction,
        provider = 'gemini',
        apiKey,
        temperature,
      } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const instruction =
        systemInstruction ||
        "You are MYRAA, a sweet, warm, melodic AI companion for Chinna. Speak naturally and concisely.";

      let responseText = "I'm right here with you, Chinna.";
      let providerUsed = provider;

      if (provider === 'grok') {
        const grokKey = apiKey || process.env.GROK_API_KEY;
        if (!grokKey) {
          return res.status(400).json({
            error: 'Grok API key is missing. Please configure your key in AI API Settings.',
          });
        }
        responseText = await callGrok({
          prompt,
          systemInstruction: instruction,
          apiKey: grokKey,
          temperature,
        });
      } else {
        // Default: Gemini
        const ai = getAi(apiKey || undefined);
        try {
          const contentRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              systemInstruction: instruction,
              temperature: temperature ?? 0.8,
            },
          });
          responseText = contentRes.text || "I'm right here with you, Chinna.";
        } catch (e: any) {
          const fallbackRes = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
              systemInstruction: instruction,
              temperature: temperature ?? 0.8,
            },
          });
          responseText = fallbackRes.text || "I'm right here with you, Chinna.";
        }
      }

      // Generate synthesized spoken voice using Aoede voice
      let base64Audio: string | null = null;
      try {
        const aiTts = getAi();
        const ttsRes = await aiTts.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: [{ parts: [{ text: responseText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        });
        base64Audio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (ttsErr: any) {
        console.warn('[Server] TTS synthesis warning:', ttsErr.message);
      }

      res.json({
        text: responseText,
        audio: base64Audio,
        providerUsed,
      });
    } catch (err: any) {
      console.error('[Server] Converse API error:', err.message || err);
      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
      });
    }
  });

  // 3. Screen Intelligence & Multimodal Vision Analysis Endpoint
  app.post('/api/screen/analyze', async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = 'image/jpeg',
        question = 'Look at my screen and explain what you see.',
        followUpContext,
        detectedApp,
        screenDebugMode = false,
        voice = 'Aoede',
        systemInstruction,
      } = req.body;

      if (!imageBase64 && !followUpContext) {
        return res.status(400).json({ error: 'Either imageBase64 or followUpContext is required.' });
      }

      const ai = getAi();

      const screenAnalysisPrompt = `
You are MYRAA, the AI companion for Chinna. You have multimodal visual intelligence to analyze what is on Chinna's screen (Android or desktop).
You speak naturally, warmly, and concisely in your friendly, melodic personality.

User's Question / Request: "${question}"
${detectedApp ? `Detected Foreground Application: ${detectedApp}` : ''}
${followUpContext ? `Short-Lived Previous Screen Context: ${JSON.stringify(followUpContext)}` : ''}
${screenDebugMode ? 'Screen Debug Mode: ENABLED. Focus on identifying root causes, stack traces, compiler errors, and providing clear actionable fixes.' : ''}

CRITICAL RULES FOR SCREEN UNDERSTANDING:
1. Programming Code:
   - Identify the language (Java, Kotlin, Python, JavaScript, TypeScript, C, C++, C#, Go, Rust, HTML, CSS, SQL, Shell, Smali, XML, JSON, etc.) if visible.
   - Explain what the code does, important variables, functions/methods, control flow, inputs, outputs, side effects, dependencies, and potential bugs.
   - Code Change Analysis: If asked "What happens if I change this?" or "Can I change this to X?", trace control flow, determine which branch becomes active, and explain the consequences based on the actual visible code.
   - Never invent code that isn't visible. If visible code is partial or cut off, say "Based on the code visible here...".
   - Output Prediction: If asked "What will the output be?", statically predict the output based on visible code. NEVER pretend you actually executed the code. Say "I can predict the result from the code, but I haven't executed it."
2. Error Analysis:
   - If an error, exception (e.g. NullPointerException), stack trace, or compiler error is visible, identify: error type, error message, likely cause, problematic line/section, and recommended fix.
   - If ScreenDebugMode is on, structure your explanation: 1. Problem, 2. Cause, 3. Recommended fix, 4. Expected result after the fix.
3. Natural Voice Output:
   - Your spokenResponse must sound like MYRAA talking to Chinna directly (e.g., "Yeah, I can see it. That error is coming from...", "If you set this boolean to true, the else branch won't execute...").
   - NEVER use robotic clichés like "Image successfully processed" or "According to OCR".
4. Privacy & Safety:
   - Do not claim files were modified.

Respond with a JSON object matching this schema:
{
  "spokenResponse": "What MYRAA speaks to Chinna out loud (warm, conversational, concise)",
  "summary": "Brief 1-line text summary of the screen content",
  "category": "CODE" | "ERROR" | "UI" | "DOCUMENT" | "TERMINAL" | "BROWSER" | "SETTINGS" | "GENERAL",
  "codeAnalysis": {
    "language": "Kotlin / Python / etc.",
    "codeSummary": "what the visible code does",
    "variables": ["var1", "var2"],
    "functions": ["func1"],
    "controlFlow": "summary of branches/loops",
    "inputsOutputs": "inputs and return values",
    "sideEffects": "any side effects",
    "potentialBugs": ["possible NPE on line X"],
    "predictedOutput": "expected console/return output",
    "changeConsequences": "consequences of requested modification",
    "isStaticPrediction": true
  },
  "errorAnalysis": {
    "hasError": true,
    "errorType": "NullPointerException",
    "errorMessage": "Attempt to invoke virtual method on a null object reference",
    "likelyCause": "Variable x was not initialized before use",
    "problematicSection": "line 42 in MainActivity.kt",
    "suggestedFix": "Add a null check or initialize with default value",
    "confidenceLevel": 0.95
  },
  "uiElements": ["Back button", "Save button", "Text input"],
  "confidence": 0.95
}
`;

      const contents: any[] = [];
      const parts: any[] = [];

      if (imageBase64) {
        // Strip data URL prefix if present
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        });
      }

      parts.push({ text: screenAnalysisPrompt });
      contents.push({ parts });

      let visionRes: any;
      try {
        visionRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction:
              systemInstruction ||
              'You are MYRAA, a smart, perceptive, sweet AI companion for Chinna. You analyze screens accurately and speak naturally.',
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        });
      } catch (e: any) {
        visionRes = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents,
          config: {
            systemInstruction:
              systemInstruction ||
              'You are MYRAA, a smart, perceptive, sweet AI companion for Chinna. You analyze screens accurately and speak naturally.',
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        });
      }

      let parsed: any = {};
      try {
        const textOutput = visionRes.text || '{}';
        parsed = JSON.parse(textOutput);
      } catch (parseErr) {
        console.warn('[Server] Vision JSON parse fallback:', parseErr);
        parsed = {
          spokenResponse: visionRes.text || "I'm looking at your screen, Chinna.",
          summary: 'Screen analyzed',
          category: 'GENERAL',
          confidence: 0.8,
        };
      }

      const spokenText = parsed.spokenResponse || parsed.summary || "I'm looking at your screen, Chinna.";

      // Synthesize spoken voice with Aoede
      let base64Audio: string | null = null;
      try {
        const ttsRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: [{ parts: [{ text: spokenText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        });
        base64Audio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (ttsErr: any) {
        console.warn('[Server] Vision TTS synthesis warning:', ttsErr.message);
      }

      res.json({
        result: parsed,
        text: spokenText,
        audio: base64Audio,
      });
    } catch (err: any) {
      console.error('[Server] Screen analyze API error:', err);
      res.status(500).json({
        error: err.message || 'Failed to analyze screen',
        text: "I couldn't read the screen just now, Chinna. Could you try showing it to me again?",
      });
    }
  });

  // 4. WebSocket Server for Gemini Live Real-time Audio
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('[Server] Client connected to Live WebSocket');
    let geminiSession: any = null;

    clientWs.send(
      JSON.stringify({
        type: 'sessionInfo',
        text: 'Connected to MYRAA Live Server',
      })
    );

    clientWs.on('message', async (data: Buffer | string) => {
      try {
        const payload = JSON.parse(data.toString());

        if (payload.type === 'initSession') {
          console.log('[Server] Initializing Gemini Live Session for Chinna...');
          try {
            const ai = getAi(payload.apiKey || undefined);
            geminiSession = await ai.live.connect({
              model: 'gemini-3.1-flash-live-preview',
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Aoede' },
                  },
                },
                systemInstruction:
                  payload.systemInstruction ||
                  'You are MYRAA, a sweet, warm, affectionate AI companion speaking live with Chinna.',
              },
              callbacks: {
                onmessage: (serverMsg: any) => {
                  // Forward model audio chunk (24kHz PCM)
                  const audioData =
                    serverMsg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                  if (audioData && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'audio',
                        data: audioData,
                      })
                    );
                  }

                  // Forward model text streaming parts if any
                  const textPart = serverMsg.serverContent?.modelTurn?.parts?.find(
                    (p: any) => p.text
                  )?.text;
                  if (textPart && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'text',
                        text: textPart,
                      })
                    );
                  }

                  // Turn completion
                  if (serverMsg.serverContent?.turnComplete && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'turnComplete',
                      })
                    );
                  }

                  // User barge-in interruption detected by Gemini Live
                  if (serverMsg.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'interrupted',
                      })
                    );
                  }
                },
                onerror: (e: any) => {
                  console.warn('[Server] Gemini Live session error:', e);
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'error',
                        error: e.message || 'Gemini Live error',
                      })
                    );
                  }
                },
                onclose: () => {
                  console.log('[Server] Gemini Live session closed');
                },
              },
            });

            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'connected',
                  model: 'gemini-3.1-flash-live-preview',
                })
              );
            }
          } catch (initErr: any) {
            console.error('[Server] Failed to connect Gemini Live:', initErr);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  error: initErr.message || 'Failed to connect to Gemini Live',
                })
              );
            }
          }
        } else if (payload.type === 'audio') {
          // Stream raw 16kHz PCM chunk from client microphone into Gemini Live
          if (geminiSession && payload.data) {
            geminiSession.sendRealtimeInput({
              audio: {
                data: payload.data,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          }
        } else if (payload.type === 'text') {
          // Send manual text prompt into active Live session
          if (geminiSession && payload.text) {
            geminiSession.sendRealtimeInput({
              text: payload.text,
            });
          }
        }
      } catch (err: any) {
        console.error('[Server] Message handling error:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('[Server] Client WebSocket closed');
      if (geminiSession) {
        try {
          geminiSession.close();
        } catch (e) {}
        geminiSession = null;
      }
    });
  });

  // 4. Vite middleware (development) or static file serving (production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`MYRAA Companion Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
