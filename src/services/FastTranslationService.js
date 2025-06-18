import { TranslationCache } from './TranslationCache.js';
import { OllamaService } from './OllamaService.js';
import axios from 'axios';

/**
 * High-performance translation service with multiple backends
 * Addresses all Performance Issues:
 * 1. Ollama Model Bottleneck - Uses fast APIs first, Ollama as fallback
 * 2. Sequential Processing - Implements caching and parallel processing
 * 3. Network Latency - Minimizes round trips with smart caching
 */
export class FastTranslationService {
  constructor() {
    this.cache = new TranslationCache(1500, 7200000); // 2 hour TTL, larger cache
    this.ollamaService = new OllamaService();
    
    // Fast external APIs (respond in 200-500ms vs 1-3s for Ollama)
    this.fastAPIs = [
      {
        name: 'mymemory',
        timeout: 1500,
        priority: 1,
        available: true
      },
      {
        name: 'libretranslate',
        timeout: 2000,
        priority: 2,
        available: true
      }
    ];
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      fastAPIHits: 0,
      ollamaHits: 0,
      errors: 0,
      averageResponseTime: 0
    };
    
    // Initialize cache with common phrases
    this.cache.preloadCommonPhrases();
    
    // Request queue for managing concurrent requests
    this.requestQueue = new Map();
    
    console.log('🚀 FastTranslationService initialized with multi-tier architecture');
  }

  async translateText(text, sourceLanguage, targetLanguage) {
    const startTime = Date.now();
    const requestId = this.generateRequestId(text, sourceLanguage, targetLanguage);
    
    // Prevent duplicate concurrent requests for same text
    if (this.requestQueue.has(requestId)) {
      console.log('⏳ Waiting for existing translation request...');
      return await this.requestQueue.get(requestId);
    }

    // Create promise for this request
    const translationPromise = this.performTranslation(text, sourceLanguage, targetLanguage, startTime);
    this.requestQueue.set(requestId, translationPromise);
    
    try {
      const result = await translationPromise;
      this.requestQueue.delete(requestId);
      return result;
    } catch (error) {
      this.requestQueue.delete(requestId);
      throw error;
    }
  }

  async performTranslation(text, sourceLanguage, targetLanguage, startTime) {
    const cleanText = text.trim();
    if (!cleanText) {
      return text;
    }

    this.metrics.totalRequests++;

    try {
      // Tier 1: Cache lookup (fastest: <10ms)
      const cached = this.cache.get(cleanText, sourceLanguage, targetLanguage);
      if (cached) {
        this.metrics.cacheHits++;
        this.updateResponseTime(startTime);
        console.log(`⚡ Cache response: ${Date.now() - startTime}ms`);
        return cached;
      }

      // Tier 2: Fast external APIs (fast: 200-800ms)
      const fastAPIResult = await this.tryFastAPIs(cleanText, sourceLanguage, targetLanguage, startTime);
      if (fastAPIResult) {
        this.metrics.fastAPIHits++;
        this.cache.set(cleanText, sourceLanguage, targetLanguage, fastAPIResult);
        this.updateResponseTime(startTime);
        return fastAPIResult;
      }

      // Tier 3: Ollama fallback (slow but high quality: 1-3s)
      if (await this.ollamaService.isAvailable()) {
        console.log('🤖 Using Ollama as fallback...');
        const ollamaResult = await this.ollamaService.translateText(cleanText, sourceLanguage, targetLanguage);
        if (ollamaResult && ollamaResult.trim().length > 0) {
          this.metrics.ollamaHits++;
          this.cache.set(cleanText, sourceLanguage, targetLanguage, ollamaResult);
          this.updateResponseTime(startTime);
          console.log(`🤖 Ollama response: ${Date.now() - startTime}ms`);
          return ollamaResult;
        }
      }

      // Tier 4: Emergency fallback
      const emergency = this.emergencyTranslation(cleanText, sourceLanguage, targetLanguage);
      this.updateResponseTime(startTime);
      console.log(`🚨 Emergency fallback: ${Date.now() - startTime}ms`);
      return emergency;

    } catch (error) {
      this.metrics.errors++;
      console.error('Translation error:', error);
      
      const emergency = this.emergencyTranslation(cleanText, sourceLanguage, targetLanguage);
      this.updateResponseTime(startTime);
      return emergency;
    }
  }

  async tryFastAPIs(text, sourceLang, targetLang, startTime) {
    // Sort APIs by priority and availability
    const availableAPIs = this.fastAPIs
      .filter(api => api.available)
      .sort((a, b) => a.priority - b.priority);

    // Try APIs in parallel for even faster response
    const promises = availableAPIs.map(api => 
      this.translateWithTimeout(api, text, sourceLang, targetLang)
        .catch(error => {
          console.warn(`${api.name} failed:`, error.message);
          return null;
        })
    );

    try {
      // Return first successful result
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const responseTime = Date.now() - startTime;
          console.log(`🌐 Fast API response: ${responseTime}ms`);
          return result.value;
        }
      }
    } catch (error) {
      console.warn('All fast APIs failed:', error);
    }

    return null;
  }

  async translateWithTimeout(api, text, sourceLang, targetLang) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), api.timeout);

    try {
      let result;
      switch (api.name) {
        case 'mymemory':
          result = await this.translateWithMyMemory(text, sourceLang, targetLang, controller.signal);
          break;
        case 'libretranslate':
          result = await this.translateWithLibreTranslate(text, sourceLang, targetLang, controller.signal);
          break;
        default:
          throw new Error(`Unknown API: ${api.name}`);
      }
      
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      // Mark API as temporarily unavailable on repeated failures
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        api.available = false;
        setTimeout(() => { api.available = true; }, 30000); // Re-enable after 30s
      }
      throw error;
    }
  }

  async translateWithMyMemory(text, sourceLang, targetLang, signal) {
    try {
      const response = await axios.get('https://api.mymemory.translated.net/get', {
        params: {
          q: text,
          langpair: `${sourceLang}|${targetLang}`
        },
        signal,
        timeout: 1500
      });

      if (response.data.responseStatus === 200) {
        const translation = response.data.responseData.translatedText;
        if (translation && translation.trim().length > 0) {
          return translation.trim();
        }
      }
      throw new Error('MyMemory API returned empty or invalid response');
    } catch (error) {
      throw error;
    }
  }

  async translateWithLibreTranslate(text, sourceLang, targetLang, signal) {
    // You can set up your own LibreTranslate instance or use a public one
    const LIBRETRANSLATE_URL = 'https://libretranslate.de/translate'; // Public instance
    
    try {
      const response = await axios.post(LIBRETRANSLATE_URL, {
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text'
      }, {
        signal,
        timeout: 2000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.translatedText) {
        return response.data.translatedText.trim();
      }
      throw new Error('LibreTranslate API returned empty response');
    } catch (error) {
      throw error;
    }
  }

  emergencyTranslation(text, sourceLang, targetLang) {
    // Return original text with language indicator as last resort
    return `[${targetLang.toUpperCase()}] ${text}`;
  }

  generateRequestId(text, sourceLang, targetLang) {
    return `${sourceLang}-${targetLang}:${text.toLowerCase().trim()}`;
  }

  updateResponseTime(startTime) {
    const responseTime = Date.now() - startTime;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / this.metrics.totalRequests;
  }

  getPerformanceMetrics() {
    const cacheStats = this.cache.getStats();
    return {
      ...this.metrics,
      cache: cacheStats,
      cacheHitRate: this.metrics.totalRequests > 0 ? 
        Math.round((this.metrics.cacheHits / this.metrics.totalRequests) * 100) : 0,
      averageResponseTime: Math.round(this.metrics.averageResponseTime),
      apiStatus: this.fastAPIs.map(api => ({
        name: api.name,
        available: api.available,
        priority: api.priority
      }))
    };
  }

  // Warm up the service by pre-translating common phrases
  async warmUp() {
    console.log('🔥 Warming up translation service...');
    const commonTexts = [
      'Hello',
      'Thank you',
      'Good morning',
      'How are you?',
      'Goodbye'
    ];

    const warmUpPromises = commonTexts.flatMap(text => [
      this.translateText(text, 'en', 'de'),
      this.translateText(text, 'de', 'en')
    ]);

    try {
      await Promise.allSettled(warmUpPromises);
      console.log('✅ Translation service warmed up');
    } catch (error) {
      console.warn('⚠️  Warm up partially failed:', error);
    }
  }

  clearCache() {
    this.cache.clear();
    console.log('🗑️  Translation cache cleared');
  }
}
