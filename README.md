# 🌟 Gemini LLM Chatbox with Supabase Persistence

An intelligent, full-stack AI chatbox application powered by Google's Gemini models (`gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`) and **Supabase Database Persistence**, built with a **strict architectural differentiation between Frontend and Backend folders**.

---

## 🏛️ Architecture & Folder Differentiation

The codebase separates client presentation from private server-side operations and database communication:

```
.antigravity-ide/
├── 📁 backend/                <--- SERVER LAYER (Private & Secure)
│   ├── .env                   # Server environment variables (Gemini & Supabase Service Key)
│   ├── .env.example           # Server environment template
│   ├── package.json           # Backend dependencies (express, cors, dotenv, @supabase/supabase-js)
│   ├── server.js              # Express API server & static host with Supabase endpoints
│   ├── geminiService.js       # Google Gemini REST & streaming engine
│   ├── supabaseService.js     # Supabase DB client, health check & chat history persistence
│   └── README.md              # Backend documentation
│
├── 📁 frontend/               <--- CLIENT LAYER (Browser & UI)
│   ├── .env                   # Frontend environment variables (Public Supabase credentials)
│   ├── .env.example           # Frontend environment template
│   ├── index.html             # Semantic markup, header, chat history sidebar & dock
│   ├── assets/                # Custom SVG avatars
│   │   ├── bot-avatar.svg     # Gemini sparkle avatar
│   │   └── user-avatar.svg    # User avatar
│   ├── styles/
│   │   └── main.css           # Vanilla CSS design system (glassmorphism & dark theme)
│   ├── js/
│   │   ├── env.js             # Environment loader (bridges frontend/.env and /api/config)
│   │   ├── api.js             # API connector, SSE decoder & Supabase REST client
│   │   ├── app.js             # State manager, history sidebar & interaction
│   │   └── markdown.js        # Markdown renderer with code copy buttons
│   └── README.md              # Frontend documentation
│
├── supabase_schema.sql        # Database schema for Supabase SQL Editor
├── start.bat                  # 1-click Windows launcher
├── package.json               # Root scripts
└── README.md                  # This documentation
```

---

## 🔐 Environment Variables (.env)

Both `frontend/` and `backend/` contain dedicated `.env` files:

### 1. Backend: `backend/.env`
Contains server-side secrets that must never be exposed to the browser:
```env
# Server Port
PORT=5000

# Google Gemini API Key
# Get a free key at: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Supabase Project Credentials
# Get from: https://supabase.com/dashboard/project/_/settings/api
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
```

### 2. Frontend: `frontend/.env`
Contains public client-safe variables:
```env
# Supabase Public Credentials (safe for browser)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Backend Server Gateway
BACKEND_URL=http://localhost:5000
```

---

## ⚡ Supabase Setup (3 Minutes)

1. **Create a Free Supabase Project**:
   Sign in to [supabase.com](https://supabase.com) and create a new project.

2. **Run the Database Schema**:
   Go to the **SQL Editor** in your Supabase dashboard and execute the contents of [`supabase_schema.sql`](file:///c:/Users/K%20N%20S%20S%20NIVEDITHA/.antigravity-ide/supabase_schema.sql). This creates:
   - `conversations` (id, title, model, timestamps)
   - `messages` (id, conversation_id, role, content, timestamps)
   - Row Level Security (RLS) policies.

3. **Copy Your API Keys**:
   From Supabase **Settings > API**, copy:
   - **Project URL** into `SUPABASE_URL` in both `frontend/.env` and `backend/.env`.
   - **anon / public key** into `SUPABASE_ANON_KEY` in both `.env` files.
   - **service_role key** into `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`.

---

## 🚀 Running the Application

### Option 1: 1-Click Launcher (Windows)
Double-click [`start.bat`](file:///c:/Users/K%20N%20S%20S%20NIVEDITHA/.antigravity-ide/start.bat).

### Option 2: Command Line
```powershell
# From workspace root:
node backend/server.js
```
Then visit: **http://localhost:5000**
