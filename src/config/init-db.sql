-- PostgreSQL 17 initialization script for Translation Memory Database

-- Create language pairs table
CREATE TABLE IF NOT EXISTS language_pairs (
  id SERIAL PRIMARY KEY,
  source_lang VARCHAR(10) NOT NULL,
  target_lang VARCHAR(10) NOT NULL,
  UNIQUE(source_lang, target_lang)
);

-- Create translations table
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
);

-- Create unknown words table
CREATE TABLE IF NOT EXISTS unknown_words (
  id SERIAL PRIMARY KEY,
  language_pair_id INTEGER REFERENCES language_pairs(id),
  word TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  contexts JSONB DEFAULT '[]',
  UNIQUE(language_pair_id, word)
);

-- Create user contributions table
CREATE TABLE IF NOT EXISTS user_contributions (
  id SERIAL PRIMARY KEY,
  language_pair_id INTEGER REFERENCES language_pairs(id),
  source_word TEXT NOT NULL,
  target_word TEXT NOT NULL,
  contributor_id TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_id TEXT,
  context TEXT
);

-- Create learning sessions table
CREATE TABLE IF NOT EXISTS learning_sessions (
  id SERIAL PRIMARY KEY,
  language_pair_id INTEGER REFERENCES language_pairs(id),
  session_id TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP WITH TIME ZONE,
  words_learned INTEGER DEFAULT 0,
  session_data JSONB DEFAULT '{}'
);

-- Insert default language pairs
INSERT INTO language_pairs (source_lang, target_lang)
VALUES 
  ('en', 'de'),
  ('de', 'en')
ON CONFLICT (source_lang, target_lang) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_translations_source_word ON translations(source_word);
CREATE INDEX IF NOT EXISTS idx_unknown_words_word ON unknown_words(word);
CREATE INDEX IF NOT EXISTS idx_translations_language_pair_id ON translations(language_pair_id);
CREATE INDEX IF NOT EXISTS idx_unknown_words_language_pair_id ON unknown_words(language_pair_id);

-- Create or update function to update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the 'updated_at' column
DROP TRIGGER IF EXISTS update_translations_updated_at ON translations;
CREATE TRIGGER update_translations_updated_at
BEFORE UPDATE ON translations
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
