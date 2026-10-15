/**
 * Frontend Environment Manager
 * Bridges frontend/.env with backend configuration and client storage.
 */

class FrontendEnv {
  constructor() {
    this.config = {
      SUPABASE_URL: localStorage.getItem('supabase_url') || '',
      SUPABASE_ANON_KEY: localStorage.getItem('supabase_anon_key') || '',
      BACKEND_URL: localStorage.getItem('backend_url') || (
        window.location.origin.includes('5000') ? window.location.origin : 'http://localhost:5000'
      )
    };
  }

  async init() {
    // 1. Try to load frontend/.env if hosted/accessible
    try {
      const res = await fetch('.env');
      if (res.ok) {
        const text = await res.text();
        this.parseEnvText(text);
      }
    } catch {}

    // 2. Query backend /api/config for auto-detected credentials
    try {
      const backendUrl = this.config.BACKEND_URL;
      const res = await fetch(`${backendUrl}/api/config`);
      if (res.ok) {
        const data = await res.json();
        if (data.supabaseUrl && !this.config.SUPABASE_URL) {
          this.config.SUPABASE_URL = data.supabaseUrl;
        }
        if (data.supabaseAnonKey && !this.config.SUPABASE_ANON_KEY) {
          this.config.SUPABASE_ANON_KEY = data.supabaseAnonKey;
        }
      }
    } catch {}

    return this.config;
  }

  parseEnvText(envText) {
    const lines = envText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (key && value && !value.includes('your-project-id') && !value.includes('your-supabase')) {
          this.config[key] = value;
        }
      }
    }
  }

  get(key) {
    return this.config[key] || '';
  }

  set(key, value) {
    this.config[key] = value;
    if (key === 'SUPABASE_URL') localStorage.setItem('supabase_url', value);
    if (key === 'SUPABASE_ANON_KEY') localStorage.setItem('supabase_anon_key', value);
    if (key === 'BACKEND_URL') localStorage.setItem('backend_url', value);
  }
}

export const env = new FrontendEnv();
