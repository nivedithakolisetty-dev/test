-- ==============================================================
-- GEMINI CHATBOX - SUPABASE DATABASE SCHEMA
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================

-- 1. Create Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New Chat',
    model TEXT DEFAULT 'gemini-2.0-flash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'model', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Index on conversation_id for fast queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 5. Create Permissive Policies for Development / Anon Key Access
DROP POLICY IF EXISTS "Public conversations read access" ON conversations;
DROP POLICY IF EXISTS "Public conversations insert access" ON conversations;
DROP POLICY IF EXISTS "Public conversations delete access" ON conversations;
DROP POLICY IF EXISTS "Public conversations update access" ON conversations;

CREATE POLICY "Public conversations read access" ON conversations FOR SELECT USING (true);
CREATE POLICY "Public conversations insert access" ON conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public conversations delete access" ON conversations FOR DELETE USING (true);
CREATE POLICY "Public conversations update access" ON conversations FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public messages read access" ON messages;
DROP POLICY IF EXISTS "Public messages insert access" ON messages;
DROP POLICY IF EXISTS "Public messages delete access" ON messages;

CREATE POLICY "Public messages read access" ON messages FOR SELECT USING (true);
CREATE POLICY "Public messages insert access" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Public messages delete access" ON messages FOR DELETE USING (true);
