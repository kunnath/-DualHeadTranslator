/**
 * High-performance translation cache with LRU eviction and TTL
 * Addresses Performance Issue #2: Sequential Processing
 */
export class TranslationCache {
  constructor(maxSize = 1000, ttl = 3600000) { // 1 hour TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.hits = 0;
    this.misses = 0;
  }

  generateKey(text, sourceLang, targetLang) {
    return `${sourceLang}-${targetLang}:${text.toLowerCase().trim()}`;
  }

  get(text, sourceLang, targetLang) {
    const key = this.generateKey(text, sourceLang, targetLang);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      this.hits++;
      console.log(`🚀 Cache hit for: "${text}" (${this.getHitRate()}% hit rate)`);
      
      // Move to end (LRU)
      this.cache.delete(key);
      this.cache.set(key, cached);
      
      return cached.translation;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    this.misses++;
    return null;
  }

  set(text, sourceLang, targetLang, translation) {
    if (!translation || translation.trim().length === 0) {
      return;
    }

    const key = this.generateKey(text, sourceLang, targetLang);
    
    // LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      translation: translation.trim(),
      timestamp: Date.now()
    });
    
    console.log(`💾 Cached translation: "${text}" → "${translation}"`);
  }

  getHitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? Math.round((this.hits / total) * 100) : 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate()
    };
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  // Pre-populate with common phrases to reduce cold start
  preloadCommonPhrases() {
    const commonPhrases = [
      // English to German
      { text: 'hello', source: 'en', target: 'de', translation: 'hallo' },
      { text: 'hi', source: 'en', target: 'de', translation: 'hallo' },
      { text: 'goodbye', source: 'en', target: 'de', translation: 'auf wiedersehen' },
      { text: 'thank you', source: 'en', target: 'de', translation: 'danke' },
      { text: 'thanks', source: 'en', target: 'de', translation: 'danke' },
      { text: 'please', source: 'en', target: 'de', translation: 'bitte' },
      { text: 'yes', source: 'en', target: 'de', translation: 'ja' },
      { text: 'no', source: 'en', target: 'de', translation: 'nein' },
      { text: 'excuse me', source: 'en', target: 'de', translation: 'entschuldigung' },
      { text: 'sorry', source: 'en', target: 'de', translation: 'entschuldigung' },
      { text: 'help', source: 'en', target: 'de', translation: 'hilfe' },
      { text: 'water', source: 'en', target: 'de', translation: 'wasser' },
      { text: 'food', source: 'en', target: 'de', translation: 'essen' },
      { text: 'bathroom', source: 'en', target: 'de', translation: 'toilette' },
      { text: 'where is', source: 'en', target: 'de', translation: 'wo ist' },
      { text: 'how much', source: 'en', target: 'de', translation: 'wie viel' },
      { text: 'i need', source: 'en', target: 'de', translation: 'ich brauche' },
      { text: 'i want', source: 'en', target: 'de', translation: 'ich möchte' },
      { text: 'good morning', source: 'en', target: 'de', translation: 'guten morgen' },
      { text: 'good evening', source: 'en', target: 'de', translation: 'guten abend' },
      
      // German to English
      { text: 'hallo', source: 'de', target: 'en', translation: 'hello' },
      { text: 'auf wiedersehen', source: 'de', target: 'en', translation: 'goodbye' },
      { text: 'danke', source: 'de', target: 'en', translation: 'thank you' },
      { text: 'bitte', source: 'de', target: 'en', translation: 'please' },
      { text: 'ja', source: 'de', target: 'en', translation: 'yes' },
      { text: 'nein', source: 'de', target: 'en', translation: 'no' },
      { text: 'entschuldigung', source: 'de', target: 'en', translation: 'excuse me' },
      { text: 'hilfe', source: 'de', target: 'en', translation: 'help' },
      { text: 'wasser', source: 'de', target: 'en', translation: 'water' },
      { text: 'essen', source: 'de', target: 'en', translation: 'food' },
      { text: 'toilette', source: 'de', target: 'en', translation: 'bathroom' },
      { text: 'wo ist', source: 'de', target: 'en', translation: 'where is' },
      { text: 'wie viel', source: 'de', target: 'en', translation: 'how much' },
      { text: 'ich brauche', source: 'de', target: 'en', translation: 'i need' },
      { text: 'ich möchte', source: 'de', target: 'en', translation: 'i want' },
      { text: 'guten morgen', source: 'de', target: 'en', translation: 'good morning' },
      { text: 'guten abend', source: 'de', target: 'en', translation: 'good evening' }
    ];

    console.log('🔄 Preloading common phrases into cache...');
    commonPhrases.forEach(phrase => {
      this.set(phrase.text, phrase.source, phrase.target, phrase.translation);
    });
    console.log(`✅ Preloaded ${commonPhrases.length} common phrases`);
  }
}
