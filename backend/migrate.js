/**
 * Supabase Migration Runner
 * Executes the database migration SQL to create all required tables, triggers, and RLS policies.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const { Client } = pg;

async function runMigration() {
  console.log('\n======================================================');
  console.log('🚀 Supabase Chatbox Database Migration Runner');
  console.log('======================================================\n');

  // Locate the migration SQL file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261014000000_create_chatbox_tables.sql');
  const fallbackPath = path.join(__dirname, '..', 'supabase_schema.sql');
  const sqlFile = fs.existsSync(migrationPath) ? migrationPath : fallbackPath;

  if (!fs.existsSync(sqlFile)) {
    console.error(`❌ Migration file not found at: ${migrationPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  // Check for direct PostgreSQL connection string
  let connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  // If DB password is provided, we can build the connection string automatically
  if (!connectionString && process.env.SUPABASE_DB_PASSWORD) {
    const projectRef = (process.env.SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0];
    if (projectRef && !projectRef.includes('your-project-id')) {
      connectionString = `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.${projectRef}.supabase.co:5432/postgres`;
    }
  }

  if (connectionString) {
    console.log('📡 Connecting directly to Supabase PostgreSQL database...');
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log('⚡ Connected! Executing single migration command...');

      await client.query(sqlContent);

      console.log('✅ Migration executed successfully!');
      console.log('   ➜ Table created: "conversations"');
      console.log('   ➜ Table created: "messages"');
      console.log('   ➜ Indexes and RLS policies applied.');
      console.log('\n🎉 Your Supabase database is ready to store chat history!\n');
    } catch (err) {
      console.error('❌ Migration query failed:', err.message);
    } finally {
      await client.end();
    }
  } else {
    // If DATABASE_URL is not configured yet
    const projectUrl = process.env.SUPABASE_URL || '';
    const projectRef = projectUrl.replace(/^https?:\/\//, '').split('.')[0];
    const sqlEditorUrl = projectRef && !projectRef.includes('your-project-id')
      ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
      : 'https://supabase.com/dashboard/project/_/sql/new';

    console.log('ℹ️  No DATABASE_URL or SUPABASE_DB_PASSWORD found in backend/.env.');
    console.log('   To execute this migration, choose one of the following:\n');

    console.log('👉 METHOD 1: 1-Click Run in Supabase SQL Editor (Recommended)');
    console.log(`   1. Open: ${sqlEditorUrl}`);
    console.log(`   2. Paste the contents of: supabase/migrations/20261014000000_create_chatbox_tables.sql`);
    console.log('   3. Click "Run". All tables, triggers, and policies will be created instantly!\n');

    console.log('👉 METHOD 2: Automated Single-Command via Terminal');
    console.log('   Add your database password or connection string to backend/.env:');
    console.log('   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.' + (projectRef || 'your-ref') + '.supabase.co:5432/postgres');
    console.log('   Then re-run:');
    console.log('   npm run migrate\n');
  }
}

runMigration().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
