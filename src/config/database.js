/**
 * PostgreSQL Database Configuration
 * Manages connection parameters and pooling for the translation memory database
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../../data');
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Created data directory: ${dataDir}`);
  }
} catch (err) {
  console.error(`Error creating data directory: ${err.message}`);
}

/**
 * Database configuration
 * Uses environment variables with fallbacks
 */
const dbConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'translation_memory',
  user: process.env.PG_USER || process.env.USER || 'postgres', // Default to current OS user
  password: process.env.PG_PASSWORD || '',
  max: parseInt(process.env.PG_POOL_MAX || '20'), // Maximum number of clients in the pool
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000'), // Close idle clients after 30 seconds
  connectionTimeoutMillis: parseInt(process.env.PG_CONNECT_TIMEOUT || '5000'), // Connection timeout
  ssl: process.env.PG_SSL === 'true' ? {
    rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false
};

/**
 * PostgreSQL client pool
 * Manages database connections efficiently
 */
const { Pool } = pg;
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Test the database connection
 * @returns {Promise<boolean>} True if connection is successful
 */
async function testConnection() {
  let client;
  try {
    console.log('Testing PostgreSQL connection...');
    client = await pool.connect();
    const result = await client.query('SELECT NOW() as now');
    console.log(`✅ PostgreSQL connection successful. Server time: ${result.rows[0].now}`);
    return true;
  } catch (err) {
    console.error('❌ PostgreSQL connection error:', err);
    
    // Check if the error is due to database not existing
    if (err.code === '3D000') { // PostgreSQL error code for "database does not exist"
      console.log('Attempting to create database...');
      try {
        // Connect to postgres default database
        const pgClient = new pg.Client({
          ...dbConfig,
          database: 'postgres' // Connect to default postgres database
        });
        
        await pgClient.connect();
        
        // Check if database exists
        const checkResult = await pgClient.query(
          "SELECT 1 FROM pg_database WHERE datname = $1",
          [dbConfig.database]
        );
        
        if (checkResult.rows.length === 0) {
          // Create the database
          await pgClient.query(`CREATE DATABASE ${dbConfig.database}`);
          console.log(`✅ Created database: ${dbConfig.database}`);
        }
        
        await pgClient.end();
        
        // Try connecting again
        return await testConnection();
      } catch (createErr) {
        console.error('❌ Failed to create database:', createErr);
        return false;
      }
    }
    
    return false;
  } finally {
    if (client) client.release();
  }
}

/**
 * Initialize the database with required tables
 * Creates tables if they don't exist
 */
async function initializeDatabase() {
  let client;
  try {
    client = await pool.connect();
    
    // Create language pairs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS language_pairs (
        id SERIAL PRIMARY KEY,
        source_lang VARCHAR(10) NOT NULL,
        target_lang VARCHAR(10) NOT NULL,
        UNIQUE(source_lang, target_lang)
      )
    `);
    
    // Create translations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS translations (
        id SERIAL PRIMARY KEY,
        language_pair_id INTEGER REFERENCES language_pairs(id),
        source_word TEXT NOT NULL,
        target_word TEXT NOT NULL,
        confidence FLOAT NOT NULL DEFAULT 0.5,
        usage_count INTEGER NOT NULL DEFAULT 1,
        user_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        context_examples JSONB DEFAULT '[]',
        domain_tags JSONB DEFAULT '[]',
        UNIQUE(language_pair_id, source_word)
      )
    `);
    
    // Create unknown words table
    await client.query(`
      CREATE TABLE IF NOT EXISTS unknown_words (
        id SERIAL PRIMARY KEY,
        language_pair_id INTEGER REFERENCES language_pairs(id),
        word TEXT NOT NULL,
        occurrence_count INTEGER NOT NULL DEFAULT 1,
        first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        contexts JSONB DEFAULT '[]',
        UNIQUE(language_pair_id, word)
      )
    `);
    
    // Create user contributions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_contributions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        translation_id INTEGER REFERENCES translations(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        source_lang VARCHAR(10) NOT NULL,
        target_lang VARCHAR(10) NOT NULL,
        source_word TEXT NOT NULL,
        target_word TEXT NOT NULL
      )
    `);
    
    // Create learning sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS learning_sessions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        session_end TIMESTAMP WITH TIME ZONE,
        source_lang VARCHAR(10) NOT NULL,
        target_lang VARCHAR(10) NOT NULL,
        words_learned INTEGER DEFAULT 0,
        words_practiced INTEGER DEFAULT 0
      )
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_translations_language_pair_id ON translations(language_pair_id);
      CREATE INDEX IF NOT EXISTS idx_unknown_words_language_pair_id ON unknown_words(language_pair_id);
      CREATE INDEX IF NOT EXISTS idx_unknown_words_occurrence ON unknown_words(occurrence_count DESC);
      CREATE INDEX IF NOT EXISTS idx_user_contributions_user_id ON user_contributions(user_id);
      CREATE INDEX IF NOT EXISTS idx_translations_confidence ON translations(confidence);
      CREATE INDEX IF NOT EXISTS idx_translations_usage_count ON translations(usage_count);
      CREATE INDEX IF NOT EXISTS idx_translations_created_at ON translations(created_at);
      CREATE INDEX IF NOT EXISTS idx_unknown_words_last_seen ON unknown_words(last_seen);
    `);
    
    console.log('✅ PostgreSQL tables initialized successfully');
    return true;
  } catch (err) {
    console.error('❌ Error initializing PostgreSQL database:', err);
    return false;
  } finally {
    if (client) client.release();
  }
}

/**
 * Execute a query with parameter binding
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/**
 * Execute a transaction with multiple queries
 * @param {Function} callback - Function that receives a client and executes queries
 * @returns {Promise<any>} Result of the transaction
 */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Close all database connections
 * Call this when shutting down the application
 */
async function close() {
  console.log('Closing PostgreSQL connection pool...');
  await pool.end();
  console.log('PostgreSQL connection pool closed');
}

// Set up process termination handlers
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Closing database connections...');
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Closing database connections...');
  await close();
  process.exit(0);
});

// Export the database interface
export default {
  pool,
  query,
  transaction,
  testConnection,
  initializeDatabase,
  close
};
