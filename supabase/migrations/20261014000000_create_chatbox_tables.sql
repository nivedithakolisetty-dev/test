-- ==============================================================
-- SUPABASE MIGRATION: Initialize Gemini Chatbox Schema
-- File: supabase/migrations/20261014000000_create_chatbox_tables.sql
-- Executing this single migration command creates all required tables,
-- foreign keys, performance indexes, timestamps, triggers, and RLS policies.
-- ==============================================================

BEGIN;

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create updated_at auto-timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New Conversation',
    model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Messages Table with Cascade Delete
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'model', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Performance Indexes for fast history queries
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);

-- 6. Attach auto-update trigger to conversations
DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 8. Permissive RLS Policies for Conversations
DROP POLICY IF EXISTS "Allow public read conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow public insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow public update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow public delete conversations" ON public.conversations;

CREATE POLICY "Allow public read conversations" 
ON public.conversations FOR SELECT USING (true);

CREATE POLICY "Allow public insert conversations" 
ON public.conversations FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update conversations" 
ON public.conversations FOR UPDATE USING (true);

CREATE POLICY "Allow public delete conversations" 
ON public.conversations FOR DELETE USING (true);

-- 9. Permissive RLS Policies for Messages
DROP POLICY IF EXISTS "Allow public read messages" ON public.messages;
DROP POLICY IF EXISTS "Allow public insert messages" ON public.messages;
DROP POLICY IF EXISTS "Allow public delete messages" ON public.messages;

CREATE POLICY "Allow public read messages" 
ON public.messages FOR SELECT USING (true);

CREATE POLICY "Allow public insert messages" 
ON public.messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete messages" 
ON public.messages FOR DELETE USING (true);

COMMIT;
