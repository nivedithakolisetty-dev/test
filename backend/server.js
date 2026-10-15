import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateContent, streamContent } from './geminiService.js';
import { supabaseService } from './supabaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config(); // fallback

// Re-initialize Supabase client after environment variables are loaded
supabaseService.initClient();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy for Render / reverse proxies
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Endpoint to provide public frontend config (Supabase URL, Anon Key, etc.)
app.get('/api/config', (req, res) => {
  const isUrlConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('your-project-id');
  const isKeyConfigured = process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY.includes('your-supabase');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const backendUrl = `${protocol}://${req.get('host')}`;

  res.json({
    supabaseUrl: isUrlConfigured ? process.env.SUPABASE_URL : '',
    supabaseAnonKey: isKeyConfigured ? process.env.SUPABASE_ANON_KEY : '',
    backendUrl,
    supabaseConfigured: isUrlConfigured && isKeyConfigured
  });
});

// Health check endpoint (checks server, Gemini key, and Supabase connection)
app.get('/api/health', async (req, res) => {
  const hasServerApiKey = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE'
  );

  const supabaseStatus = await supabaseService.testConnection();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasServerApiKey,
    supabase: supabaseStatus
  });
});

// Available Gemini models endpoint
app.get('/api/models', (req, res) => {
  res.json({
    models: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Fastest next-gen multimodal model, ideal for responsive chat',
        isDefault: true
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'High speed and low latency general purpose model',
        isDefault: false
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Complex reasoning, in-depth analysis, and long context',
        isDefault: false
      }
    ]
  });
});

// ==============================================================
// Supabase Conversation & History Endpoints
// ==============================================================

// List all conversations
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await supabaseService.getConversations();
    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const { title = 'New Chat', model = 'gemini-2.0-flash' } = req.body;
    const conversation = await supabaseService.createConversation(title, model);
    if (!conversation) {
      return res.status(503).json({
        error: 'Supabase Not Configured',
        message: 'Could not create conversation. Check SUPABASE_URL and SUPABASE_KEY in backend/.env'
      });
    }
    res.json({ conversation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a specific conversation
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await supabaseService.getMessages(id);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a conversation
app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await supabaseService.deleteConversation(id);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to resolve API key from request header, body, or server .env
function getApiKey(req) {
  const clientKey = req.headers['x-gemini-key'] || req.body?.apiKey;
  if (clientKey && typeof clientKey === 'string' && clientKey.trim().length > 0) {
    return clientKey.trim();
  }
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim().length > 0 && envKey !== 'YOUR_GEMINI_API_KEY_HERE') {
    return envKey.trim();
  }
  return null;
}

// Chat completion endpoint (with Supabase automatic message persistence)
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      model = 'gemini-2.0-flash',
      systemInstruction,
      temperature = 0.7,
      stream = false,
      conversationId = null
    } = req.body;

    const apiKey = getApiKey(req);
    if (!apiKey) {
      return res.status(401).json({
        error: 'Missing Gemini API Key',
        message: 'No Gemini API key provided. Please configure GEMINI_API_KEY in backend/.env or enter your key in the web interface settings.'
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'A non-empty "messages" array is required.'
      });
    }

    // If conversationId is supplied, save the latest user message to Supabase
    if (conversationId && supabaseService.isConfigured()) {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg && lastUserMsg.role === 'user') {
        supabaseService.saveMessage(conversationId, 'user', lastUserMsg.content).catch(err => {
          console.warn('[Supabase AutoSave User Error]:', err.message);
        });
      }
    }

    if (stream) {
      // Wrapper to intercept and save full assistant response to Supabase when finished
      const originalWrite = res.write.bind(res);
      let assistantText = '';

      res.write = function (chunk, encoding, callback) {
        if (typeof chunk === 'string') {
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.text) assistantText += parsed.text;
              } catch {}
            }
          }
        }
        return originalWrite(chunk, encoding, callback);
      };

      res.on('finish', () => {
        if (conversationId && assistantText && supabaseService.isConfigured()) {
          supabaseService.saveMessage(conversationId, 'assistant', assistantText).catch(err => {
            console.warn('[Supabase AutoSave Assistant Error]:', err.message);
          });
        }
      });

      return await streamContent({
        apiKey,
        model,
        messages,
        systemInstruction,
        temperature,
        res
      });
    } else {
      const result = await generateContent({
        apiKey,
        model,
        messages,
        systemInstruction,
        temperature
      });

      if (conversationId && result?.reply && supabaseService.isConfigured()) {
        supabaseService.saveMessage(conversationId, 'assistant', result.reply).catch(err => {
          console.warn('[Supabase AutoSave Assistant Error]:', err.message);
        });
      }

      return res.json(result);
    }
  } catch (error) {
    console.error('[Gemini API Error]:', error.message);
    return res.status(500).json({
      error: 'Gemini Error',
      message: error.message || 'An error occurred while generating response.'
    });
  }
});

// Fallback route for frontend client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Gemini Chatbox Backend Server running at:`);
  console.log(`   ➜ Local: http://localhost:${PORT}`);
  console.log(`   ➜ Health: http://localhost:${PORT}/api/health`);
  console.log(`   ➜ Gemini Key Configured: ${Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE')}`);
  console.log(`   ➜ Supabase Configured: ${supabaseService.isConfigured()}`);
  console.log(`======================================================\n`);
});
