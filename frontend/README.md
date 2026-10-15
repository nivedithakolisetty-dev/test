# 🎨 Gemini Chatbox Frontend (with Supabase)

A modern, responsive, high-aesthetic web interface for interacting with Google's Gemini Large Language Models and browsing saved chat sessions from Supabase.

---

## 📁 Folder Structure

```
frontend/
├── .env.example       # Template for frontend environment variables
├── .env               # Your local frontend environment variables
├── assets/
│   ├── bot-avatar.svg      # Gemini sparkle avatar
│   └── user-avatar.svg     # User profile avatar
├── js/
│   ├── env.js              # Environment loader (bridges frontend/.env and /api/config)
│   ├── api.js              # Backend client, SSE stream decoder & Supabase REST client
│   ├── app.js              # State controller, conversation history & prompt chips
│   └── markdown.js         # Sanitized markdown converter with copyable code snippets
├── styles/
│   └── main.css            # Custom CSS design system (dark mode, glassmorphism, history sidebar)
├── index.html              # Accessible semantic markup with history sidebar and settings
└── README.md               # Frontend documentation
```

---

## 🔐 Environment Variables (`frontend/.env`)

Create or edit `frontend/.env` with:

```env
# Supabase Project Credentials (safe for client-side usage)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Backend Server URL
BACKEND_URL=http://localhost:5000
```

---

## ✨ Features

- **Supabase Chat History**: Browse, load, or delete past conversations directly from the collapsible history sidebar.
- **Auto-Persistence**: When chatting, user and assistant messages are automatically recorded to Supabase.
- **Real-Time Streaming**: Stream response tokens directly from Gemini with smooth typing cursor animations.
- **Zero Key Leakage**: Secret keys (`GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`) are isolated inside `backend/.env`.
- **Model Switcher**: Switch between `gemini-2.0-flash`, `gemini-1.5-flash`, and `gemini-1.5-pro`.
- **Markdown & Code Highlighting**: Syntax containers with 1-click **Copy Code** buttons.
