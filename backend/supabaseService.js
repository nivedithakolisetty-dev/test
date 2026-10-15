import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

class SupabaseService {
  constructor() {
    this.client = null;
    this.initClient();
  }

  initClient() {
    const url = process.env.SUPABASE_URL?.trim();
    // Prefer service role key for backend operations; fallback to anon key
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();

    if (
      url &&
      key &&
      !url.includes('your-project-id') &&
      !key.includes('your-supabase')
    ) {
      try {
        this.client = createClient(url, key, {
          auth: { persistSession: false }
        });
      } catch (err) {
        console.error('[Supabase Init Error]:', err.message);
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  isConfigured() {
    return this.client !== null;
  }

  /**
   * Health check / connection test with Supabase
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return {
        connected: false,
        message: 'Supabase credentials are not configured or still have placeholder values in .env'
      };
    }

    try {
      // Query table or check server health
      const { data, error } = await this.client
        .from('conversations')
        .select('id')
        .limit(1);

      if (error) {
        // If table does not exist yet (PostgreSQL 42P01 or PostgREST PGRST205)
        if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          return {
            connected: true,
            tablesCreated: false,
            message: 'Connected to Supabase project, but "conversations" table is not created yet. Run supabase_schema.sql in the Supabase SQL editor.'
          };
        }
        return {
          connected: false,
          error: error.message,
          code: error.code
        };
      }

      return {
        connected: true,
        tablesCreated: true,
        message: 'Supabase connection active and verified.'
      };
    } catch (err) {
      return {
        connected: false,
        error: err.message
      };
    }
  }

  /**
   * Create a new conversation session
   */
  async createConversation(title = 'New Chat', model = 'gemini-2.0-flash') {
    if (!this.isConfigured()) return null;

    const { data, error } = await this.client
      .from('conversations')
      .insert([{ title, model }])
      .select()
      .single();

    if (error) {
      console.warn('[Supabase createConversation Warning]:', error.message);
      return null;
    }

    return data;
  }

  /**
   * Retrieve all conversations ordered by recent
   */
  async getConversations(limit = 30) {
    if (!this.isConfigured()) return [];

    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[Supabase getConversations Warning]:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * Get all messages for a specific conversation
   */
  async getMessages(conversationId) {
    if (!this.isConfigured() || !conversationId) return [];

    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[Supabase getMessages Warning]:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * Save a single message to Supabase
   */
  async saveMessage(conversationId, role, content) {
    if (!this.isConfigured() || !conversationId) return null;

    const { data, error } = await this.client
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          role,
          content
        }
      ])
      .select()
      .single();

    if (error) {
      console.warn('[Supabase saveMessage Warning]:', error.message);
      return null;
    }

    // Also update conversation's updated_at timestamp
    await this.client
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId) {
    if (!this.isConfigured() || !conversationId) return false;

    const { error } = await this.client
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    return !error;
  }
}

export const supabaseService = new SupabaseService();
