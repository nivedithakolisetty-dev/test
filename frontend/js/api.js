/**
 * Frontend API Client
 * Interfaces with the backend server and handles streaming responses via Server-Sent Events (SSE).
 * Also integrates Supabase conversation persistence endpoints.
 */

const DEFAULT_BACKEND_URL = window.location.origin.includes('localhost:5000') || window.location.origin.includes('127.0.0.1:5000')
  ? window.location.origin
  : 'http://localhost:5000';

class GeminiApiClient {
  constructor() {
    this.baseUrl = localStorage.getItem('gemini_backend_url') || DEFAULT_BACKEND_URL;
    this.currentAbortController = null;
  }

  setBaseUrl(url) {
    this.baseUrl = url.replace(/\/+$/, '');
    localStorage.setItem('gemini_backend_url', this.baseUrl);
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  /**
   * Health check to detect backend status and whether server .env key and Supabase are loaded.
   */
  async checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, { method: 'GET' });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return await res.json();
    } catch (err) {
      return { status: 'offline', error: err.message, hasServerApiKey: false, supabase: { connected: false } };
    }
  }

  /**
   * Fetch public environment configuration from backend
   */
  async fetchConfig() {
    try {
      const res = await fetch(`${this.baseUrl}/api/config`);
      if (res.ok) return await res.json();
    } catch {}
    return null;
  }

  /**
   * Fetch list of supported models.
   */
  async fetchModels() {
    try {
      const res = await fetch(`${this.baseUrl}/api/models`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return data.models || [];
    } catch {
      return [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', isDefault: true },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', isDefault: false },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', isDefault: false }
      ];
    }
  }

  // ==============================================================
  // Supabase Conversations API
  // ==============================================================

  async fetchConversations() {
    try {
      const res = await fetch(`${this.baseUrl}/api/conversations`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.conversations || [];
    } catch {
      return [];
    }
  }

  async createConversation(title = 'New Chat', model = 'gemini-2.0-flash') {
    try {
      const res = await fetch(`${this.baseUrl}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, model })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.conversation;
    } catch {
      return null;
    }
  }

  async fetchConversationMessages(conversationId) {
    try {
      const res = await fetch(`${this.baseUrl}/api/conversations/${conversationId}/messages`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.messages || [];
    } catch {
      return [];
    }
  }

  async deleteConversation(conversationId) {
    try {
      const res = await fetch(`${this.baseUrl}/api/conversations/${conversationId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Stops any ongoing streaming response.
   */
  stopGeneration() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  /**
   * Send chat messages to the backend.
   */
  async sendChat({
    messages,
    model = 'gemini-2.0-flash',
    systemInstruction,
    temperature = 0.7,
    stream = true,
    customApiKey = '',
    conversationId = null,
    onChunk,
    onComplete,
    onError
  }) {
    this.stopGeneration();
    this.currentAbortController = new AbortController();

    const headers = {
      'Content-Type': 'application/json'
    };

    if (customApiKey && customApiKey.trim()) {
      headers['x-gemini-key'] = customApiKey.trim();
    }

    const payload = {
      messages,
      model,
      systemInstruction,
      temperature,
      stream,
      conversationId
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: this.currentAbortController.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const message = errJson.message || errJson.error || `Server responded with ${response.status}`;
        throw new Error(message);
      }

      // If streaming
      if (stream) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullAccumulatedText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep partial chunk in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const payloadStr = trimmed.slice(6);
            if (payloadStr === '[DONE]') {
              continue;
            }

            try {
              const data = JSON.parse(payloadStr);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.text) {
                fullAccumulatedText += data.text;
                if (typeof onChunk === 'function') {
                  onChunk(data.text, fullAccumulatedText);
                }
              }
            } catch (parseErr) {
              // Ignore partial JSON parse warnings
            }
          }
        }

        if (typeof onComplete === 'function') {
          onComplete(fullAccumulatedText);
        }
        return fullAccumulatedText;
      } else {
        // Non-streaming response
        const data = await response.json();
        const reply = data.reply || '';
        if (typeof onComplete === 'function') {
          onComplete(reply);
        }
        return reply;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        if (typeof onComplete === 'function') {
          onComplete('(Response generation stopped by user)');
        }
        return;
      }
      if (typeof onError === 'function') {
        onError(err);
      } else {
        throw err;
      }
    } finally {
      this.currentAbortController = null;
    }
  }
}

export const api = new GeminiApiClient();
