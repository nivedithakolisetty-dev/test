import { api } from './api.js';
import { renderMarkdown } from './markdown.js';
import { env } from './env.js';

// Application State
const state = {
  messages: [],
  isGenerating: false,
  currentConversationId: null,
  conversations: [],
  model: localStorage.getItem('gemini_model') || 'gemini-2.0-flash',
  temperature: parseFloat(localStorage.getItem('gemini_temp') || '0.7'),
  streaming: localStorage.getItem('gemini_streaming') !== 'false',
  systemPrompt: localStorage.getItem('gemini_system') || 'You are a helpful, brilliant, and friendly AI assistant. Format your answers with clear markdown where appropriate.',
  customApiKey: localStorage.getItem('gemini_custom_key') || '',
  supabaseUrl: localStorage.getItem('supabase_url') || '',
  supabaseAnonKey: localStorage.getItem('supabase_anon_key') || '',
  hasServerKey: false,
  supabaseConnected: false,
  backendConnected: false
};

// DOM Elements
const elements = {
  chatContainer: document.getElementById('chatContainer'),
  messagesList: document.getElementById('messagesList'),
  emptyState: document.getElementById('emptyState'),
  promptForm: document.getElementById('promptForm'),
  userInput: document.getElementById('userInput'),
  btnSend: document.getElementById('btnSend'),
  btnStop: document.getElementById('btnStop'),
  modelSelector: document.getElementById('modelSelector'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  keyStatusBadge: document.getElementById('keyStatusBadge'),
  supabaseStatusBadge: document.getElementById('supabaseStatusBadge'),
  // Buttons
  btnClear: document.getElementById('btnClear'),
  btnExport: document.getElementById('btnExport'),
  btnSettings: document.getElementById('btnSettings'),
  btnNewChat: document.getElementById('btnNewChat'),
  btnToggleHistory: document.getElementById('btnToggleHistory'),
  btnCloseSidebar: document.getElementById('btnCloseSidebar'),
  // Sidebar
  historySidebar: document.getElementById('historySidebar'),
  conversationsList: document.getElementById('conversationsList'),
  // Settings Drawer
  settingsDrawer: document.getElementById('settingsDrawer'),
  settingsBackdrop: document.getElementById('settingsBackdrop'),
  btnCloseSettings: document.getElementById('btnCloseSettings'),
  settingApiKey: document.getElementById('settingApiKey'),
  settingSupabaseUrl: document.getElementById('settingSupabaseUrl'),
  settingSupabaseAnonKey: document.getElementById('settingSupabaseAnonKey'),
  settingBackendUrl: document.getElementById('settingBackendUrl'),
  settingTemp: document.getElementById('settingTemp'),
  tempValueDisplay: document.getElementById('tempValueDisplay'),
  settingStream: document.getElementById('settingStream'),
  settingSystemPrompt: document.getElementById('settingSystemPrompt'),
  btnSaveSettings: document.getElementById('btnSaveSettings'),
  // Toast
  toast: document.getElementById('toast')
};

// ==============================================================
// Utility Functions
// ==============================================================

function showToast(message, type = 'info') {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.className = `toast toast-${type} toast-visible`;
  setTimeout(() => {
    elements.toast.classList.remove('toast-visible');
  }, 3200);
}

function scrollToBottom(smooth = true) {
  if (!elements.chatContainer) return;
  elements.chatContainer.scrollTo({
    top: elements.chatContainer.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

function autoResizeTextarea() {
  const textarea = elements.userInput;
  if (!textarea) return;
  textarea.style.height = 'auto';
  const newHeight = Math.min(textarea.scrollHeight, 180);
  textarea.style.height = `${newHeight}px`;
}

function escapeHtmlSimple(text) {
  const p = document.createElement('p');
  p.textContent = text;
  return p.innerHTML.replace(/\n/g, '<br/>');
}

function updateEmptyState() {
  if (!elements.emptyState) return;
  elements.emptyState.style.display = state.messages.length > 0 ? 'none' : 'flex';
}

// ==============================================================
// Message Rendering
// ==============================================================

function createMessageElement(role, content = '', isStreaming = false) {
  const isUser = role === 'user';
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message-row ${isUser ? 'user-row' : 'bot-row'}`;

  const avatarSrc = isUser ? 'assets/user-avatar.svg' : 'assets/bot-avatar.svg';
  const senderName = isUser ? 'You' : 'Gemini AI';
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  wrapper.innerHTML = `
    <div class="message-avatar">
      <img src="${avatarSrc}" alt="${senderName}" width="36" height="36" />
    </div>
    <div class="message-content-wrapper">
      <div class="message-header">
        <span class="message-sender">${senderName}</span>
        <span class="message-time">${timeStr}</span>
      </div>
      <div class="message-bubble ${isUser ? 'bubble-user' : 'bubble-bot'}">
        <div class="bubble-body">${isUser ? escapeHtmlSimple(content) : renderMarkdown(content)}</div>
        ${!isUser && isStreaming ? '<div class="typing-cursor"></div>' : ''}
      </div>
      <div class="message-actions">
        <button type="button" class="btn-msg-action btn-copy-msg" title="Copy message">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>
    </div>
  `;

  const copyBtn = wrapper.querySelector('.btn-copy-msg');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        showToast('Message copied to clipboard!', 'success');
      });
    });
  }

  return wrapper;
}

// ==============================================================
// Chat & Supabase Persistence Logic
// ==============================================================

async function handleSendMessage(promptText) {
  const text = (promptText || elements.userInput.value).trim();
  if (!text || state.isGenerating) return;

  // Clear input field and reset height
  elements.userInput.value = '';
  autoResizeTextarea();

  // If Supabase is connected and no active conversation exists, auto-create one
  if (state.supabaseConnected && !state.currentConversationId) {
    const titleSnippet = text.length > 30 ? text.slice(0, 30) + '...' : text;
    const newConv = await api.createConversation(titleSnippet, state.model);
    if (newConv && newConv.id) {
      state.currentConversationId = newConv.id;
      loadConversations();
    }
  }

  // Add user message to state & UI
  state.messages.push({ role: 'user', content: text });
  updateEmptyState();

  const userMsgEl = createMessageElement('user', text);
  elements.messagesList.appendChild(userMsgEl);
  scrollToBottom();

  // Prepare Bot placeholder in UI
  const botMsgEl = createMessageElement('assistant', '', true);
  elements.messagesList.appendChild(botMsgEl);
  scrollToBottom();

  const bubbleBody = botMsgEl.querySelector('.bubble-body');
  const typingCursor = botMsgEl.querySelector('.typing-cursor');

  setGenerating(true);

  let accumulatedContent = '';

  try {
    await api.sendChat({
      messages: state.messages,
      model: state.model,
      systemInstruction: state.systemPrompt,
      temperature: state.temperature,
      stream: state.streaming,
      customApiKey: state.customApiKey,
      conversationId: state.currentConversationId,
      onChunk: (chunk, fullText) => {
        accumulatedContent = fullText;
        bubbleBody.innerHTML = renderMarkdown(accumulatedContent);
        scrollToBottom();
      },
      onComplete: (fullText) => {
        accumulatedContent = fullText || accumulatedContent;
        bubbleBody.innerHTML = renderMarkdown(accumulatedContent);
        if (typingCursor) typingCursor.remove();
        state.messages.push({ role: 'assistant', content: accumulatedContent });

        const copyBtn = botMsgEl.querySelector('.btn-copy-msg');
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(accumulatedContent).then(() => {
              showToast('Response copied to clipboard!', 'success');
            });
          };
        }
      },
      onError: (err) => {
        if (typingCursor) typingCursor.remove();
        bubbleBody.innerHTML = `
          <div class="error-bubble">
            <span class="error-icon">⚠️</span>
            <div class="error-content">
              <strong>Gemini API Error</strong>
              <p>${err.message}</p>
              ${
                !state.hasServerKey && !state.customApiKey
                  ? '<button class="btn-prompt-chip fix-key-btn" id="openSettingsPrompt">Configure API Key</button>'
                  : ''
              }
            </div>
          </div>
        `;
        showToast(err.message, 'error');

        const fixBtn = bubbleBody.querySelector('#openSettingsPrompt');
        if (fixBtn) {
          fixBtn.addEventListener('click', openSettings);
        }
      }
    });
  } catch (err) {
    if (typingCursor) typingCursor.remove();
    bubbleBody.innerHTML = `<span class="text-error">Error: ${err.message}</span>`;
  } finally {
    setGenerating(false);
    scrollToBottom();
  }
}

function setGenerating(isGen) {
  state.isGenerating = isGen;
  if (isGen) {
    elements.btnSend.style.display = 'none';
    elements.btnStop.style.display = 'inline-flex';
  } else {
    elements.btnSend.style.display = 'inline-flex';
    elements.btnStop.style.display = 'none';
  }
}

// ==============================================================
// Supabase Conversation History Manager
// ==============================================================

async function loadConversations() {
  if (!elements.conversationsList) return;
  const list = await api.fetchConversations();
  state.conversations = list;

  if (list.length === 0) {
    elements.conversationsList.innerHTML = `
      <div class="history-empty-note">
        <span>⚡ No Supabase chats found.</span>
        <small>${state.supabaseConnected ? 'Start chatting to create one.' : 'Configure Supabase in .env to auto-sync.'}</small>
      </div>
    `;
    return;
  }

  elements.conversationsList.innerHTML = '';
  list.forEach(conv => {
    const card = document.createElement('div');
    card.className = `conversation-card ${conv.id === state.currentConversationId ? 'active-chat' : ''}`;
    const dateStr = new Date(conv.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });

    card.innerHTML = `
      <div class="conv-info">
        <span class="conv-title">${escapeHtmlSimple(conv.title)}</span>
        <span class="conv-date">${dateStr} • ${conv.model || 'gemini'}</span>
      </div>
      <button type="button" class="btn-del-conv" title="Delete conversation">🗑️</button>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-del-conv')) return;
      selectConversation(conv.id);
    });

    const delBtn = card.querySelector('.btn-del-conv');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete chat "${conv.title}"?`)) {
          const success = await api.deleteConversation(conv.id);
          if (success) {
            showToast('Chat deleted from Supabase', 'info');
            if (state.currentConversationId === conv.id) {
              startNewChat();
            } else {
              loadConversations();
            }
          }
        }
      });
    }

    elements.conversationsList.appendChild(card);
  });
}

async function selectConversation(convId) {
  state.currentConversationId = convId;
  const dbMessages = await api.fetchConversationMessages(convId);

  state.messages = dbMessages.map(m => ({
    role: m.role,
    content: m.content
  }));

  elements.messagesList.innerHTML = '';
  state.messages.forEach(m => {
    const el = createMessageElement(m.role, m.content, false);
    elements.messagesList.appendChild(el);
  });

  updateEmptyState();
  scrollToBottom(false);
  loadConversations();
  showToast('Loaded conversation from Supabase', 'success');
}

function startNewChat() {
  state.currentConversationId = null;
  state.messages = [];
  elements.messagesList.innerHTML = '';
  updateEmptyState();
  loadConversations();
  showToast('Started new chat session', 'info');
}

// ==============================================================
// Settings & Drawer
// ==============================================================

function openSettings() {
  elements.settingApiKey.value = state.customApiKey;
  elements.settingSupabaseUrl.value = state.supabaseUrl || env.get('SUPABASE_URL');
  elements.settingSupabaseAnonKey.value = state.supabaseAnonKey || env.get('SUPABASE_ANON_KEY');
  elements.settingBackendUrl.value = api.getBaseUrl();
  elements.settingTemp.value = state.temperature;
  elements.tempValueDisplay.textContent = state.temperature.toFixed(1);
  elements.settingStream.checked = state.streaming;
  elements.settingSystemPrompt.value = state.systemPrompt;

  elements.settingsDrawer.classList.add('drawer-open');
  elements.settingsBackdrop.classList.add('backdrop-open');
}

function closeSettings() {
  elements.settingsDrawer.classList.remove('drawer-open');
  elements.settingsBackdrop.classList.remove('backdrop-open');
}

function saveSettings() {
  state.customApiKey = elements.settingApiKey.value.trim();
  localStorage.setItem('gemini_custom_key', state.customApiKey);

  state.supabaseUrl = elements.settingSupabaseUrl.value.trim();
  env.set('SUPABASE_URL', state.supabaseUrl);

  state.supabaseAnonKey = elements.settingSupabaseAnonKey.value.trim();
  env.set('SUPABASE_ANON_KEY', state.supabaseAnonKey);

  const newUrl = elements.settingBackendUrl.value.trim();
  if (newUrl) {
    api.setBaseUrl(newUrl);
    env.set('BACKEND_URL', newUrl);
  }

  state.temperature = parseFloat(elements.settingTemp.value);
  localStorage.setItem('gemini_temp', state.temperature.toString());

  state.streaming = elements.settingStream.checked;
  localStorage.setItem('gemini_streaming', state.streaming.toString());

  state.systemPrompt = elements.settingSystemPrompt.value.trim();
  localStorage.setItem('gemini_system', state.systemPrompt);

  closeSettings();
  showToast('Settings & Environment applied', 'success');
  checkBackendHealth();
}

// ==============================================================
// Health & Environment Initialization
// ==============================================================

async function checkBackendHealth() {
  elements.statusIndicator.className = 'status-dot dot-checking';
  elements.statusText.textContent = 'Connecting...';

  const health = await api.checkHealth();
  if (health.status === 'ok') {
    state.backendConnected = true;
    state.hasServerKey = health.hasServerApiKey;

    elements.statusIndicator.className = 'status-dot dot-online';
    elements.statusText.textContent = 'Backend Online';

    // Gemini Key status
    if (state.hasServerKey) {
      elements.keyStatusBadge.className = 'key-badge key-active';
      elements.keyStatusBadge.innerHTML = '● Gemini Key Active';
      elements.keyStatusBadge.title = 'Gemini API key loaded from backend/.env';
    } else if (state.customApiKey) {
      elements.keyStatusBadge.className = 'key-badge key-custom';
      elements.keyStatusBadge.innerHTML = '● Custom Key Set';
      elements.keyStatusBadge.title = 'Custom API key active in browser';
    } else {
      elements.keyStatusBadge.className = 'key-badge key-missing';
      elements.keyStatusBadge.innerHTML = '⚠️ No Gemini Key';
      elements.keyStatusBadge.title = 'Click Settings to enter your Gemini API key';
    }

    // Supabase Status
    const sb = health.supabase;
    if (sb && sb.connected) {
      state.supabaseConnected = true;
      if (sb.tablesCreated === false) {
        elements.supabaseStatusBadge.className = 'key-badge key-missing';
        elements.supabaseStatusBadge.innerHTML = '⚡ Run SQL Schema';
        elements.supabaseStatusBadge.title = 'Supabase connected, but tables need to be created. See supabase_schema.sql';
      } else {
        elements.supabaseStatusBadge.className = 'key-badge key-supabase-active';
        elements.supabaseStatusBadge.innerHTML = '⚡ Supabase Active';
        elements.supabaseStatusBadge.title = 'Supabase DB connected and persisting chats';
      }
      loadConversations();
    } else {
      state.supabaseConnected = false;
      elements.supabaseStatusBadge.className = 'key-badge key-missing';
      elements.supabaseStatusBadge.innerHTML = '⚡ Supabase: Set .env';
      elements.supabaseStatusBadge.title = 'Supabase not configured in backend/.env';
    }
  } else {
    state.backendConnected = false;
    elements.statusIndicator.className = 'status-dot dot-offline';
    elements.statusText.textContent = 'Backend Offline';
    elements.keyStatusBadge.className = 'key-badge key-missing';
    elements.keyStatusBadge.innerHTML = '⚠️ Start Backend';
    elements.supabaseStatusBadge.className = 'key-badge key-missing';
    elements.supabaseStatusBadge.innerHTML = '⚡ Supabase Offline';
  }
}

async function loadModels() {
  const models = await api.fetchModels();
  if (!elements.modelSelector) return;

  elements.modelSelector.innerHTML = '';
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name || m.id;
    if (m.id === state.model) opt.selected = true;
    elements.modelSelector.appendChild(opt);
  });

  elements.modelSelector.addEventListener('change', (e) => {
    state.model = e.target.value;
    localStorage.setItem('gemini_model', state.model);
    showToast(`Model switched to ${e.target.options[e.target.selectedIndex].text}`, 'info');
  });
}

// ==============================================================
// Event Listeners Initialization
// ==============================================================

function initEventListeners() {
  // Input form submission
  elements.promptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  // Textarea Enter key (Shift+Enter for newline)
  elements.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  elements.userInput.addEventListener('input', autoResizeTextarea);

  // Stop button
  elements.btnStop.addEventListener('click', () => {
    api.stopGeneration();
    setGenerating(false);
    showToast('Generation cancelled', 'info');
  });

  // Quick Prompt Chips in Empty State
  document.querySelectorAll('.btn-prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        handleSendMessage(prompt);
      }
    });
  });

  // New Chat
  elements.btnNewChat?.addEventListener('click', startNewChat);

  // Clear chat
  elements.btnClear.addEventListener('click', () => {
    if (state.messages.length === 0) return;
    if (confirm('Clear messages from the current view?')) {
      state.messages = [];
      elements.messagesList.innerHTML = '';
      updateEmptyState();
      showToast('Chat view cleared', 'info');
    }
  });

  // Export chat
  elements.btnExport.addEventListener('click', () => {
    if (state.messages.length === 0) {
      showToast('No messages to export', 'info');
      return;
    }
    const markdownContent = state.messages
      .map(m => `### ${m.role === 'user' ? 'User' : 'Gemini AI'}\n\n${m.content}\n\n---`)
      .join('\n\n');

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-supabase-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Conversation exported as Markdown', 'success');
  });

  // Sidebar toggles
  elements.btnToggleHistory?.addEventListener('click', () => {
    elements.historySidebar.classList.toggle('sidebar-collapsed');
  });
  elements.btnCloseSidebar?.addEventListener('click', () => {
    elements.historySidebar.classList.add('sidebar-collapsed');
  });

  // Settings Drawer Toggle
  elements.btnSettings.addEventListener('click', openSettings);
  elements.btnCloseSettings.addEventListener('click', closeSettings);
  elements.settingsBackdrop.addEventListener('click', closeSettings);
  elements.btnSaveSettings.addEventListener('click', saveSettings);
  elements.keyStatusBadge.addEventListener('click', openSettings);
  elements.supabaseStatusBadge.addEventListener('click', openSettings);

  // Temperature slider display
  elements.settingTemp.addEventListener('input', (e) => {
    elements.tempValueDisplay.textContent = parseFloat(e.target.value).toFixed(1);
  });

  // Global delegate for code copy buttons
  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.btn-copy-code');
    if (copyBtn) {
      const encodedCode = copyBtn.getAttribute('data-code');
      const code = decodeURIComponent(encodedCode);
      navigator.clipboard.writeText(code).then(() => {
        const copyText = copyBtn.querySelector('.copy-text');
        if (copyText) {
          const original = copyText.textContent;
          copyText.textContent = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyText.textContent = original;
            copyBtn.classList.remove('copied');
          }, 2000);
        }
      });
    }
  });
}

// Start application
document.addEventListener('DOMContentLoaded', async () => {
  await env.init();
  initEventListeners();
  autoResizeTextarea();
  checkBackendHealth();
  loadModels();
  setInterval(checkBackendHealth, 15000);
});
