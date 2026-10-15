/**
 * Gemini Service
 * Handles direct communication with Google's Gemini Generative Language REST API.
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Formats standard chat history (role: user/assistant, content: text)
 * into Gemini's contents structure (role: user/model, parts: [{ text }]).
 */
export function formatMessagesForGemini(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(msg => msg && msg.content && typeof msg.content === 'string')
    .map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content.trim() }]
    }));
}

/**
 * Generates a full response from Gemini (non-streaming).
 */
export async function generateContent({
  apiKey,
  model = 'gemini-2.0-flash',
  messages = [],
  systemInstruction = 'You are a helpful, concise, and friendly AI assistant. Use markdown formatting where appropriate.',
  temperature = 0.7
}) {
  if (!apiKey) {
    throw new Error('Gemini API Key is required.');
  }

  const endpoint = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = formatMessagesForGemini(messages);

  if (contents.length === 0) {
    throw new Error('At least one user message is required.');
  }

  const payload = {
    contents,
    generationConfig: {
      temperature: Number(temperature) || 0.7,
      maxOutputTokens: 2048
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Gemini API returned status ${response.status}`;
    throw new Error(errorMsg);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('No candidate response received from Gemini.');
  }

  const replyText = candidate.content?.parts?.map(p => p.text).join('') || '';
  const finishReason = candidate.finishReason || 'STOP';

  return {
    reply: replyText,
    finishReason,
    model,
    usage: data.usageMetadata || null
  };
}

/**
 * Streams response from Gemini using Server-Sent Events (SSE).
 */
export async function streamContent({
  apiKey,
  model = 'gemini-2.0-flash',
  messages = [],
  systemInstruction = 'You are a helpful, concise, and friendly AI assistant. Use markdown formatting where appropriate.',
  temperature = 0.7,
  res
}) {
  if (!apiKey) {
    throw new Error('Gemini API Key is required.');
  }

  const endpoint = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const contents = formatMessagesForGemini(messages);

  if (contents.length === 0) {
    throw new Error('At least one user message is required.');
  }

  const payload = {
    contents,
    generationConfig: {
      temperature: Number(temperature) || 0.7,
      maxOutputTokens: 2048
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const upstreamRes = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!upstreamRes.ok) {
    const errData = await upstreamRes.json().catch(() => ({}));
    const errorMsg = errData?.error?.message || `Gemini API returned status ${upstreamRes.status}`;
    throw new Error(errorMsg);
  }

  // Set SSE headers on client response
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep partial line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const textChunk = parsed.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
            if (textChunk) {
              res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
            }
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }
    }

    // Send final [DONE] indicator
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
