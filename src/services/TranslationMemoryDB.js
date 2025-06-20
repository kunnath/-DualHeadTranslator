import db from '../config/database.js';

export class TranslationMemoryDB {
  constructor() {
    this.pool = db.pool;
    
    this.initialized = false;
    this.initPromise = this.initDatabase();
    
    console.log('🐘 PostgreSQL 17 Translation Database initialized');
  }
  
  async initDatabase() {
    try {
      // Create necessary tables if they don't exist
      await db.query(`
        CREATE TABLE IF NOT EXISTS language_pairs (
          id SERIAL PRIMARY KEY,
          source_lang VARCHAR(10) NOT NULL,
          target_lang VARCHAR(10) NOT NULL,
          UNIQUE(source_lang, target_lang)
        )
      `);
      
      await db.query(`
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
      
      await db.query(`
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
      
      await db.query(`
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
      
      await db.query(`
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
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_translations_language_pair_id ON translations(language_pair_id);
        CREATE INDEX IF NOT EXISTS idx_unknown_words_language_pair_id ON unknown_words(language_pair_id);
        CREATE INDEX IF NOT EXISTS idx_unknown_words_occurrence ON unknown_words(occurrence_count DESC);
        CREATE INDEX IF NOT EXISTS idx_user_contributions_user_id ON user_contributions(user_id);
        CREATE INDEX IF NOT EXISTS idx_translations_confidence ON translations(confidence);
      `);
      
      console.log('✅ PostgreSQL translation tables initialized');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Error initializing PostgreSQL database:', error);
      throw error;
    }
  }
  
  async getOrCreateLanguagePair(sourceLang, targetLang) {
    try {
      await this.initPromise; // Ensure database is initialized
      
      // Try to find existing language pair
      const findResult = await db.query(
        'SELECT id FROM language_pairs WHERE source_lang = $1 AND target_lang = $2',
        [sourceLang, targetLang]
      );
      
      if (findResult.rows.length > 0) {
        return findResult.rows[0].id;
      }
      
      // Create new language pair
      const insertResult = await db.query(
        'INSERT INTO language_pairs (source_lang, target_lang) VALUES ($1, $2) RETURNING id',
        [sourceLang, targetLang]
      );
      
      return insertResult.rows[0].id;
    } catch (error) {
      console.error('Error getting/creating language pair:', error);
      throw error;
    }
  }
  
  /**
   * Look up a word in the translation database
   */
  async lookup(word, sourceLang, targetLang) {
    try {
      await this.initPromise; // Ensure database is initialized
      
      const normalizedWord = word.toLowerCase().trim();
      const langPairId = await this.getOrCreateLanguagePair(sourceLang, targetLang);
      
      const result = await db.query(
        `SELECT target_word AS translation, confidence, usage_count, user_verified, context_examples, domain_tags
         FROM translations
         WHERE language_pair_id = $1 AND source_word = $2`,
        [langPairId, normalizedWord]
      );
      
      if (result.rows.length > 0) {
        // Increment usage count for this word
        await db.query(
          `UPDATE translations 
           SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
           WHERE language_pair_id = $1 AND source_word = $2`,
          [langPairId, normalizedWord]
        );
        
        return {
          translation: result.rows[0].translation,
          confidence: result.rows[0].confidence,
          usageCount: result.rows[0].usage_count + 1, // Increment locally too
          userVerified: result.rows[0].user_verified,
          contextExamples: result.rows[0].context_examples || [],
          domainTags: result.rows[0].domain_tags || []
        };
      }
      
      // Record unknown word if not found
      await this.recordUnknownWord(normalizedWord, sourceLang, targetLang);
      
      return null;
    } catch (error) {
      console.error('Error looking up translation:', error);
      return null;
    }
  }
  
  /**
   * Add or update a word in the translation database
   */
  async addOrUpdate(word, translation, sourceLang, targetLang, confidence = 0.5, isUserVerified = false, context = null, domainTag = null) {
    try {
      // Input validation
      if (!word || typeof word !== 'string') {
        console.error('Invalid word parameter:', word);
        return null;
      }
      if (!translation || typeof translation !== 'string') {
        console.error('Invalid translation parameter:', translation);
        return null;
      }
      if (!sourceLang || !targetLang) {
        console.error('Missing language parameters:', { sourceLang, targetLang });
        return null;
      }
      
      await this.initPromise; // Ensure database is initialized
      
      const normalizedWord = word.toLowerCase().trim();
      const langPairId = await this.getOrCreateLanguagePair(sourceLang, targetLang);
      
      // Check if word already exists
      const existingResult = await db.query(
        `SELECT id, confidence, usage_count, user_verified, context_examples, domain_tags
         FROM translations
         WHERE language_pair_id = $1 AND source_word = $2`,
        [langPairId, normalizedWord]
      );
      
      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        
        // Don't downgrade user-verified translations unless this is also user-verified
        if (existing.user_verified && !isUserVerified) {
          // Just update usage count
          await db.query(
            `UPDATE translations 
             SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [existing.id]
          );
          return existing.id;
        }
        
        // Update existing entry
        let newConfidence = existing.confidence;
        if (isUserVerified) {
          newConfidence = 1.0; // User-verified gets max confidence
        } else {
          // Weighted average of confidences
          const totalConfidence = existing.confidence * existing.usage_count + confidence;
          const newUsageCount = existing.usage_count + 1;
          newConfidence = totalConfidence / newUsageCount;
        }
        
        // Update context examples if provided
        let contextExamples = existing.context_examples || [];
        if (context && !contextExamples.includes(context)) {
          try {
            // Check if contextExamples is already an array or needs to be parsed
            const examplesArray = Array.isArray(contextExamples) ? contextExamples : 
                            (typeof contextExamples === 'string' && contextExamples.startsWith('[') ? 
                            JSON.parse(contextExamples) : [contextExamples]);
            contextExamples = [...examplesArray, context].slice(-5); // Keep last 5 examples
          } catch (error) {
            console.error(`Error parsing context examples: ${error.message}`);
            // Fallback to simple array with new context
            contextExamples = [context];
          }
        }
        
        // Update domain tags if provided
        let domainTags = existing.domain_tags || [];
        if (domainTag && !domainTags.includes(domainTag)) {
          try {
            // Check if domainTags is already an array or needs to be parsed
            const tagsArray = Array.isArray(domainTags) ? domainTags : 
                          (typeof domainTags === 'string' && domainTags.startsWith('[') ? 
                          JSON.parse(domainTags) : [domainTags]);
            domainTags = [...tagsArray, domainTag];
          } catch (error) {
            console.error(`Error parsing domain tags: ${error.message}`);
            // Fallback to simple array with new domain tag
            domainTags = [domainTag];
          }
        }
        
        await db.query(
          `UPDATE translations 
           SET target_word = $1, confidence = $2, usage_count = usage_count + 1, 
               user_verified = $3, updated_at = CURRENT_TIMESTAMP, 
               context_examples = $4, domain_tags = $5
           WHERE id = $6`,
          [translation, newConfidence, isUserVerified || existing.user_verified, 
           JSON.stringify(contextExamples), JSON.stringify(domainTags), existing.id]
        );
        
        return existing.id;
      }
      
      // Insert new translation
      const contextArray = context ? [context] : [];
      const domainArray = domainTag ? [domainTag] : [];
      
      try {
        const insertResult = await db.query(
          `INSERT INTO translations 
           (language_pair_id, source_word, target_word, confidence, user_verified, 
            context_examples, domain_tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [langPairId, normalizedWord, translation, confidence, isUserVerified, 
           JSON.stringify(contextArray),
           JSON.stringify(domainArray)]
        );
        
        // Remove from unknown words if it was there
        await db.query(
          `DELETE FROM unknown_words 
           WHERE language_pair_id = $1 AND word = $2`,
          [langPairId, normalizedWord]
        );
        
        return insertResult.rows[0].id;
      } catch (dbError) {
        console.error('Database error during translation insert:', dbError);
        // Try with a simpler insert as fallback
        try {
          const fallbackResult = await db.query(
            `INSERT INTO translations 
             (language_pair_id, source_word, target_word, confidence, user_verified)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [langPairId, normalizedWord, translation, confidence, isUserVerified]
          );
          console.log('Successfully inserted translation with fallback method');
          return fallbackResult.rows[0].id;
        } catch (fallbackError) {
          console.error('Fallback insert also failed:', fallbackError);
          return null;
        }
      }
    } catch (error) {
      console.error('Error adding/updating translation:', error);
      // Log detailed information for debugging
      console.error('Parameters:', {
        word, 
        translation, 
        sourceLang, 
        targetLang, 
        confidence, 
        isUserVerified, 
        context, 
        domainTag
      });
      // Don't rethrow, return null instead to allow the application to continue
      return null;
    }
  }
  
  /**
   * Record an unknown word with context
   */
  async recordUnknownWord(word, sourceLang, targetLang, context = null) {
    try {
      await this.initPromise; // Ensure database is initialized
      
      const normalizedWord = word.toLowerCase().trim();
      const langPairId = await this.getOrCreateLanguagePair(sourceLang, targetLang);
      
      // Check if already exists
      const existingResult = await db.query(
        `SELECT id, contexts FROM unknown_words 
         WHERE language_pair_id = $1 AND word = $2`,
        [langPairId, normalizedWord]
      );
      
      if (existingResult.rows.length > 0) {
        // Update count and last_seen
        let contexts = existingResult.rows[0].contexts || [];
        
        // Add new context if provided
        if (context) {
          contexts = [...JSON.parse(contexts), context].slice(-5); // Keep last 5 contexts
        }
        
        await db.query(
          `UPDATE unknown_words 
           SET occurrence_count = occurrence_count + 1, 
               last_seen = CURRENT_TIMESTAMP,
               contexts = $2
           WHERE id = $1`,
          [existingResult.rows[0].id, contexts ? JSON.stringify(contexts) : '[]']
        );
      } else {
        // Insert new unknown word
        await db.query(
          `INSERT INTO unknown_words (language_pair_id, word, contexts)
           VALUES ($1, $2, $3)`,
          [langPairId, normalizedWord, context ? JSON.stringify([context]) : '[]']
        );
      }
    } catch (error) {
      console.error('Error recording unknown word:', error);
      // Don't throw - this is a non-critical operation
    }
  }
  
  /**
   * Check if a word exists in the translations database
   */
  async checkWordExists(word, sourceLang, targetLang) {
    try {
      await this.initPromise;
      
      const normalizedWord = word.toLowerCase().trim();
      const langPairId = await this.getOrCreateLanguagePair(sourceLang, targetLang);
      
      const result = await db.query(
        `SELECT COUNT(*) FROM translations
         WHERE language_pair_id = $1 AND source_word = $2`,
        [langPairId, normalizedWord]
      );
      
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Error checking if word exists:', error);
      return false; // Assume it doesn't exist if there's an error
    }
  }

  /**
   * Add a word to the unknown words table with context
   */
  async addUnknownWord(word, sourceLang, targetLang, context = null) {
    try {
      await this.initPromise;
      
      const normalizedWord = word.toLowerCase().trim();
      const langPairId = await this.getOrCreateLanguagePair(sourceLang, targetLang);
      
      // Check if word already exists in unknown_words
      const existingResult = await db.query(
        `SELECT id, occurrence_count, contexts FROM unknown_words
         WHERE language_pair_id = $1 AND word = $2`,
        [langPairId, normalizedWord]
      );
      
      if (existingResult.rows.length > 0) {
        // Update existing entry
        const existing = existingResult.rows[0];
        
        // Update contexts if provided
        let contexts = existing.contexts || [];
        if (context) {
          try {
            // Parse contexts if it's a string, otherwise use as is
            const contextsArray = Array.isArray(contexts) ? contexts : 
                             (typeof contexts === 'string' && contexts.startsWith('[') ? 
                              JSON.parse(contexts) : [contexts]);
            
            // Add new context if not already present
            if (!contextsArray.includes(context)) {
              contexts = [...contextsArray, context].slice(-5); // Keep last 5 contexts
            } else {
              contexts = contextsArray;
            }
          } catch (error) {
            console.error(`Error parsing unknown word contexts: ${error.message}`);
            // Fallback to simple array with new context
            contexts = context ? [context] : [];
          }
        }
        
        await db.query(
          `UPDATE unknown_words 
           SET occurrence_count = occurrence_count + 1, 
               last_seen = CURRENT_TIMESTAMP,
               contexts = $1
           WHERE id = $2`,
          [JSON.stringify(contexts), existing.id]
        );
        
        return existing.id;
      } else {
        // Insert new unknown word
        const contextsArray = context ? [context] : [];
        
        const insertResult = await db.query(
          `INSERT INTO unknown_words 
           (language_pair_id, word, contexts)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [langPairId, normalizedWord, JSON.stringify(contextsArray)]
        );
        
        return insertResult.rows[0].id;
      }
    } catch (error) {
      console.error('Error adding unknown word:', error);
      return null;
    }
  }

  /**
   * Record an occurrence of a potentially unknown word
   */
  async recordUnknownWordOccurrence(word, sourceLang, targetLang, context = null) {
    try {
      await this.initPromise;
      
      const normalizedWord = word.toLowerCase().trim();
      const langPairId = await this.getOrCreateLanguagePair(sourceLang, targetLang);
      
      // Check if word already exists in translations
      const existsInTranslations = await this.checkWordExists(normalizedWord, sourceLang, targetLang);
      
      // If it exists in translations, we don't need to record it as unknown
      if (existsInTranslations) {
        return null;
      }
      
      // Otherwise, add or update it in unknown_words
      return await this.addUnknownWord(normalizedWord, sourceLang, targetLang, context);
    } catch (error) {
      console.error('Error recording unknown word occurrence:', error);
      // Don't rethrow
      return null;
    }
  }

  /**
   * Get priority unknown words that need translation
   */
  async getPriorityUnknownWords(sourceLang, targetLang, limit = 20) {
    try {
      await this.initPromise;
      
      const langPairId = await this.getOrCreateLanguagePair(sourceLang, targetLang);
      
      const result = await db.query(
        `SELECT id, word, occurrence_count, contexts
         FROM unknown_words
         WHERE language_pair_id = $1
         ORDER BY occurrence_count DESC, last_seen DESC
         LIMIT $2`,
        [langPairId, limit]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        word: row.word,
        occurrenceCount: row.occurrence_count,
        contexts: typeof row.contexts === 'string' ? JSON.parse(row.contexts) : row.contexts
      }));
    } catch (error) {
      console.error('Error getting priority unknown words:', error);
      return [];
    }
  }

  /**
   * Record a user contribution
   */
  async recordUserContribution(userId, translationId) {
    try {
      await this.initPromise;
      
      await db.query(
        `INSERT INTO user_contributions (user_id, translation_id, contributed_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, translation_id) DO NOTHING`,
        [userId, translationId]
      );
      
      return true;
    } catch (error) {
      console.error('Error recording user contribution:', error);
      return false;
    }
  }

  /**
   * Get user contribution statistics
   */
  async getUserContributionStats(userId) {
    try {
      await this.initPromise;
      
      const result = await db.query(
        `SELECT COUNT(*) as total_contributions 
         FROM user_contributions 
         WHERE user_id = $1`,
        [userId]
      );
      
      return {
        totalContributions: parseInt(result.rows[0].total_contributions),
        userId: userId
      };
    } catch (error) {
      console.error('Error getting user contribution stats:', error);
      return { totalContributions: 0, userId: userId };
    }
  }
  
  /**
   * Start a learning session for a user
   */
  async startLearningSession(userId, sourceLang, targetLang) {
    try {
      await this.initPromise;
      
      // Close any existing open sessions
      await db.query(
        `UPDATE learning_sessions
         SET session_end = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND session_end IS NULL`,
        [userId]
      );
      
      // Create new session
      const result = await db.query(
        `INSERT INTO learning_sessions
         (user_id, source_lang, target_lang)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userId, sourceLang, targetLang]
      );
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error starting learning session:', error);
      throw error;
    }
  }
  
  /**
   * End a learning session
   */
  async endLearningSession(sessionId) {
    try {
      await this.initPromise;
      
      await db.query(
        `UPDATE learning_sessions
         SET session_end = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [sessionId]
      );
    } catch (error) {
      console.error('Error ending learning session:', error);
      throw error;
    }
  }
  
  /**
   * Get domain-specific terms
   */
  async getDomainSpecificTerms(domain, sourceLang, targetLang, limit = 20) {
    try {
      await this.initPromise;
      
      const langPairId = await this.getOrCreateLanguagePair(sourceLang, targetLang);
      
      const result = await this.pool.query(
        `SELECT source_word, target_word, confidence 
         FROM translations
         WHERE language_pair_id = $1 
         AND domain_tags @> $2
         ORDER BY confidence DESC
         LIMIT $3`,
        [langPairId, JSON.stringify([domain]), limit]
      );
      
      return result.rows.map(row => ({
        sourceWord: row.source_word,
        translation: row.target_word,
        confidence: row.confidence
      }));
    } catch (error) {
      console.error('Error getting domain-specific terms:', error);
      return [];
    }
  }
  
  /**
   * Learn from conversation context
   * This method analyzes full sentences to try to automatically learn word translations
   */
  async learnFromConversation(sourceText, translatedText, sourceLang, targetLang, confidence = 0.6) {
    try {
      // Input validation
      if (!sourceText || typeof sourceText !== 'string' || !translatedText || typeof translatedText !== 'string') {
        console.error('Invalid text parameters:', { sourceText, translatedText });
        return;
      }
      
      if (!sourceLang || !targetLang) {
        console.error('Missing language parameters:', { sourceLang, targetLang });
        return;
      }
      
      await this.initPromise;
      
      // Process and clean the source and target words
      const sourceWords = sourceText.split(/\s+/);
      const targetWords = translatedText.split(/\s+/);
      
      // Store the full sentence context first
      try {
        await this.addOrUpdate(
          sourceText,
          translatedText,
          sourceLang,
          targetLang,
          confidence,
          false,
          null
        );
        console.log(`📚 Stored full sentence pair: "${sourceText}" → "${translatedText}"`);
      } catch (sentenceError) {
        console.error('Error storing full sentence during learning:', sentenceError);
        // Continue with word learning even if sentence storage failed
      }
      
      // Do a better word alignment if the sentence lengths are similar
      if (Math.abs(sourceWords.length - targetWords.length) <= 3) {
        // Then try to learn individual words with more advanced handling
        const minLength = Math.min(sourceWords.length, targetWords.length);
        
        for (let i = 0; i < minLength; i++) {
          try {
            // Clean words of punctuation
            const sourceWord = sourceWords[i].replace(/[,.!?;:'"()]/g, '').toLowerCase();
            const targetWord = targetWords[i].replace(/[,.!?;:'"()]/g, '').toLowerCase();
            
            // Skip very short words as they're often articles, prepositions, etc.
            if (sourceWord.length > 2 && targetWord.length > 2) {
              await this.addOrUpdate(
                sourceWord,
                targetWord,
                sourceLang,
                targetLang,
                confidence * 0.7, // Lower confidence for automatic word alignment
                false,
                sourceText
              );
            }
          } catch (wordError) {
            console.error(`Error processing word pair at index ${i}:`, wordError);
            // Continue with next word pair
          }
        }
      }
      
      // Store unknown words for both languages for bidirectional learning
      for (const word of sourceWords) {
        const cleanWord = word.replace(/[,.!?;:'"()]/g, '').toLowerCase();
        if (cleanWord.length > 2) {
          try {
            await this.recordUnknownWordOccurrence(cleanWord, sourceLang, targetLang, sourceText);
          } catch (error) {
            console.error(`Error recording unknown source word "${cleanWord}":`, error);
            // Continue with other words
          }
        }
      }
      
      for (const word of targetWords) {
        const cleanWord = word.replace(/[,.!?;:'"()]/g, '').toLowerCase();
        if (cleanWord.length > 2) {
          try {
            // Also track unknown words in the target language (for bidirectional learning)
            await this.recordUnknownWordOccurrence(cleanWord, targetLang, sourceLang, translatedText);
          } catch (error) {
            console.error(`Error recording unknown target word "${cleanWord}":`, error);
            // Continue with other words
          }
        }
      }
      
      console.log(`✅ Successfully learned from conversation: "${sourceText}" → "${translatedText}"`);
    } catch (error) {
      console.error('Error learning from conversation:', error);
      // Don't rethrow to allow application to continue
    }
  }
  
  /**
   * Get statistics about the translation database
   */
  async getStats() {
    try {
      await this.initPromise; // Ensure database is initialized
      
      const stats = {
        totalEntries: 0,
        languagePairs: {},
        pendingWords: 0,
        userContributions: 0,
        domains: {},
        learningRate: {
          daily: 0,
          weekly: 0,
          monthly: 0
        }
      };
      
      // Count total translations
      const translationsResult = await this.pool.query(
        'SELECT COUNT(*) FROM translations'
      );
      stats.totalEntries = parseInt(translationsResult.rows[0].count);
      
      // Count by language pair
      const langPairsResult = await this.pool.query(
        `SELECT lp.source_lang, lp.target_lang, COUNT(t.id) as count
         FROM language_pairs lp
         LEFT JOIN translations t ON lp.id = t.language_pair_id
         GROUP BY lp.id, lp.source_lang, lp.target_lang`
      );
      
      langPairsResult.rows.forEach(row => {
        const key = `${row.source_lang}-${row.target_lang}`;
        stats.languagePairs[key] = parseInt(row.count);
      });
      
      // Count pending words
      const pendingResult = await this.pool.query(
        'SELECT COUNT(*) FROM unknown_words'
      );
      stats.pendingWords = parseInt(pendingResult.rows[0].count);
      
      // Count user contributions
      const contributionsResult = await this.pool.query(
        'SELECT COUNT(*) FROM user_contributions'
      );
      stats.userContributions = parseInt(contributionsResult.rows[0].count);
      
      // Get learning rate (new words per period)
      const dailyResult = await this.pool.query(
        `SELECT COUNT(*) FROM translations 
         WHERE created_at > NOW() - INTERVAL '1 day'`
      );
      stats.learningRate.daily = parseInt(dailyResult.rows[0].count);
      
      const weeklyResult = await this.pool.query(
        `SELECT COUNT(*) FROM translations 
         WHERE created_at > NOW() - INTERVAL '7 days'`
      );
      stats.learningRate.weekly = parseInt(weeklyResult.rows[0].count);
      
      const monthlyResult = await this.pool.query(
        `SELECT COUNT(*) FROM translations 
         WHERE created_at > NOW() - INTERVAL '30 days'`
      );
      stats.learningRate.monthly = parseInt(monthlyResult.rows[0].count);
      
      // Get domains
      const domainsResult = await this.pool.query(
        `SELECT domain_tags, COUNT(*) 
         FROM translations 
         WHERE jsonb_array_length(domain_tags) > 0 
         GROUP BY domain_tags`
      );
      
      domainsResult.rows.forEach(row => {
        const domains = JSON.parse(row.domain_tags);
        domains.forEach(domain => {
          stats.domains[domain] = (stats.domains[domain] || 0) + parseInt(row.count);
        });
      });
      
      return stats;
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        totalEntries: 0,
        languagePairs: {},
        pendingWords: 0,
        userContributions: 0,
        domains: {},
        learningRate: { daily: 0, weekly: 0, monthly: 0 }
      };
    }
  }
  
  /**
   * Clean up database connection when done
   * Note: We don't close the pool here since it's managed by the shared database config
   */
  async close() {
    try {
      console.log('TranslationMemoryDB shutdown completed');
    } catch (error) {
      console.error('Error during TranslationMemoryDB shutdown:', error);
    }
  }
}
