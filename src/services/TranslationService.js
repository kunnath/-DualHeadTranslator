import { OllamaService } from './OllamaService.js';

export class TranslationService {
  constructor() {
    // Initialize Ollama for translation
    this.ollamaService = new OllamaService();
    this.useOllama = true;
    
    console.log('🔄 TranslationService initialized with Ollama backend');
    
    // Fallback translation mappings for offline use
    this.fallbackTranslations = {
      'en-de': {
        'hello': 'hallo',
        'goodbye': 'auf wiedersehen',
        'thank you': 'danke',
        'please': 'bitte',
        'yes': 'ja',
        'no': 'nein',
        'how are you': 'wie geht es dir',
        'good morning': 'guten morgen',
        'good evening': 'guten abend',
        'excuse me': 'entschuldigung',
        'i don\'t understand': 'ich verstehe nicht',
        'can you help me': 'können sie mir helfen',
        'where is': 'wo ist',
        'how much': 'wie viel'
      },
      'de-en': {
        'hallo': 'hello',
        'auf wiedersehen': 'goodbye',
        'danke': 'thank you',
        'bitte': 'please',
        'ja': 'yes',
        'nein': 'no',
        'wie geht es dir': 'how are you',
        'guten morgen': 'good morning',
        'guten abend': 'good evening',
        'entschuldigung': 'excuse me',
        'ich verstehe nicht': 'i don\'t understand',
        'können sie mir helfen': 'can you help me',
        'wo ist': 'where is',
        'wie viel': 'how much'
      }
    };
  }

  /**
   * Translate text using Ollama with DeepSeek-R1
   */
  async translateText(text, sourceLanguage, targetLanguage) {
    try {
      if (!text || text.trim().length === 0) {
        return '';
      }

      // Use Ollama for high-quality translation
      if (this.ollamaService.isAvailable()) {
        console.log(`🔄 Using Ollama for translation: ${sourceLanguage} -> ${targetLanguage}`);
        return await this.ollamaService.translateText(text, sourceLanguage, targetLanguage);
      }

      // Fallback to simple translation
      console.warn('⚠️  Ollama not available, using fallback translation');
      return this.translateWithFallback(text, sourceLanguage, targetLanguage);
      
    } catch (error) {
      console.error('Translation error:', error);
      
      // Try fallback if Ollama fails
      console.warn('🔄 Ollama translation failed, using fallback');
      return this.translateWithFallback(text, sourceLanguage, targetLanguage);
    }
  }

  /**
   * Advanced translation using Ollama with DeepSeek-R1
   */
  async translateWithOllama(text, sourceLanguage, targetLanguage) {
    try {
      return await this.ollamaService.translateText(text, sourceLanguage, targetLanguage);
    } catch (error) {
      console.error('Ollama translation error:', error);
      throw error;
    }
  }

  /**
   * Fallback translation for basic phrases
   */
  translateWithFallback(text, sourceLanguage, targetLanguage) {
    const key = `${sourceLanguage}-${targetLanguage}`;
    const translations = this.fallbackTranslations[key];
    
    if (!translations) {
      return `[Translation not available: ${text}]`;
    }

    const lowerText = text.toLowerCase().trim();
    
    // Check for exact matches
    if (translations[lowerText]) {
      return translations[lowerText];
    }

    // Check for partial matches
    for (const [original, translated] of Object.entries(translations)) {
      if (lowerText.includes(original)) {
        return text.replace(new RegExp(original, 'gi'), translated);
      }
    }

    return `[Translation needed: ${text}]`;
  }

  /**
   * Detect language of input text
   */
  async detectLanguage(text) {
    try {
      if (process.env.OPENAI_API_KEY) {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Detect the language of the given text. Respond with only the language code: "en" for English or "de" for German.'
            },
            {
              role: 'user',
              content: text
            }
          ],
          max_tokens: 10,
          temperature: 0
        });

        const detectedLang = response.choices[0].message.content.trim().toLowerCase();
        return ['en', 'de'].includes(detectedLang) ? detectedLang : 'en';
      }

      // Simple fallback detection
      const germanWords = ['der', 'die', 'das', 'und', 'ich', 'ist', 'haben', 'sein', 'auf', 'für'];
      const words = text.toLowerCase().split(' ');
      const germanCount = words.filter(word => germanWords.includes(word)).length;
      
      return germanCount > 0 ? 'de' : 'en';
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en'; // Default to English
    }
  }

  /**
   * Get supported language pairs
   */
  getSupportedLanguagePairs() {
    return [
      { source: 'en', target: 'de', name: 'English → German' },
      { source: 'de', target: 'en', name: 'German → English' }
    ];
  }
}
