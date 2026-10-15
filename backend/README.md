# 🧠 Gemini Chatbox Backend (with Supabase)

This is the backend service for the Gemini LLM Chatbox. It securely handles communication with Google's Gemini API and persists conversations to Supabase.

---

## 📁 Folder Structure

```
backend/
├── .env.example       # Template for environment variables
├── .env               # Your local environment variables (keep secret!)
├── package.json       # Node.js project manifest & dependencies
├── server.js          # Express server with CORS, routing & Supabase endpoints
├── geminiService.js   # Gemini REST API communication (streaming + standard)
├── supabaseService.js # Supabase client, health checks & message persistence
└── README.md          # Backend documentation
```

---

## 🔐 Environment Variables (`backend/.env`)

Create or edit `backend/.env` with:

```env
# Server Port
PORT=5000

# Google Gemini API Key
# https://aistudio.google.com/app/apikey
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Supabase Project Credentials
# https://supabase.com/dashboard/project/_/settings/api
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
```

---

## 📡 API Endpoints

- `GET /api/health`: Server status, Gemini key check, and Supabase connection test.
- `GET /api/config`: Exposes public client-safe configuration (`supabaseUrl`, `supabaseAnonKey`, `backendUrl`).
- `GET /api/models`: Lists supported Gemini models.
- `POST /api/chat`: Sends chat messages to Gemini (SSE streaming or JSON) and auto-persists to Supabase if `conversationId` is provided.
- `GET /api/conversations`: Fetches saved conversations from Supabase.
- `POST /api/conversations`: Creates a new conversation record.
- `GET /api/conversations/:id/messages`: Fetches messages for a conversation.
- `DELETE /api/conversations/:id`: Deletes a conversation from Supabase.
