import { OllamaService } from './OllamaService.js';
import { FastGrammarService } from './FastGrammarService.js';

export class GrammarTeachingService {
  constructor() {
    this.ollamaService = new OllamaService();
    this.fastGrammarService = new FastGrammarService();
    this.recentTranslations = new Map(); // Store recent translations per user
    this.teachingCache = new Map(); // Cache teaching explanations
    this.useFastMode = true; // Use fast analysis by default
    console.log('📚 GrammarTeachingService initialized with fast grammar analysis');
  }

  // Store recent translation for teaching reference
  storeTranslation(userId, originalText, translatedText, sourceLanguage, targetLanguage) {
    if (!this.recentTranslations.has(userId)) {
      this.recentTranslations.set(userId, []);
    }
    
    const userTranslations = this.recentTranslations.get(userId);
    
    // Keep only last 10 translations per user
    if (userTranslations.length >= 10) {
      userTranslations.shift();
    }
    
    userTranslations.push({
      id: Date.now(),
      originalText,
      translatedText,
      sourceLanguage,
      targetLanguage,
      timestamp: new Date().toISOString()
    });
    
    console.log(`📚 Stored translation for teaching: "${originalText}" → "${translatedText}"`);
  }

  // Get recent translations for a user
  getRecentTranslations(userId, limit = 5) {
    const userTranslations = this.recentTranslations.get(userId) || [];
    return userTranslations.slice(-limit).reverse(); // Most recent first
  }

  // Generate teaching explanation using Ollama
  async generateTeachingExplanation(question, translationContext) {
    const cacheKey = `${question}-${translationContext.originalText}-${translationContext.translatedText}`;
    
    // Check cache first
    if (this.teachingCache.has(cacheKey)) {
      console.log('📖 Using cached teaching explanation');
      return this.teachingCache.get(cacheKey);
    }

    try {
      const prompt = this.createTeachingPrompt(question, translationContext);
      console.log('🤖 Generating teaching explanation with Ollama...');
      
      const response = await this.ollamaService.chat(prompt);
      
      // Cache the response
      this.teachingCache.set(cacheKey, response);
      
      // Limit cache size
      if (this.teachingCache.size > 100) {
        const firstKey = this.teachingCache.keys().next().value;
        this.teachingCache.delete(firstKey);
      }
      
      return response;
      
    } catch (error) {
      console.error('Error generating teaching explanation:', error);
      return this.getFallbackExplanation(question, translationContext);
    }
  }

  createTeachingPrompt(question, translationContext) {
    const { originalText, translatedText, sourceLanguage, targetLanguage } = translationContext;
    
    return `You are a language teacher helping a student understand translation and grammar. 

Translation Context:
- Original (${sourceLanguage}): "${originalText}"
- Translation (${targetLanguage}): "${translatedText}"

Student Question: "${question}"

Please provide a clear, educational explanation that covers:
1. Grammar analysis of the relevant words/phrases
2. Word usage and meaning
3. Articles (der/die/das for German, a/an/the for English) if applicable
4. Verb tenses and conjugations if relevant
5. Cultural or contextual notes if helpful

Keep your explanation:
- Clear and easy to understand
- Focused on the specific question
- Educational but not overwhelming
- Include examples when helpful

Response:`;
  }

  getFallbackExplanation(question, translationContext) {
    const { originalText, translatedText, sourceLanguage, targetLanguage } = translationContext;
    
    // Basic fallback responses for common questions
    const fallbacks = {
      'grammar': `Grammar analysis for "${originalText}" → "${translatedText}": This translation involves ${sourceLanguage} to ${targetLanguage} conversion. The sentence structure follows standard ${targetLanguage} grammar patterns.`,
      'article': `Articles in this translation: In German, nouns have specific articles (der/die/das), while English uses a/an/the. Check the gender and case of German nouns.`,
      'tense': `Tense analysis: The verb tense in "${originalText}" is preserved in the translation "${translatedText}". Pay attention to verb endings and auxiliary verbs.`,
      'usage': `Word usage: Each word in "${originalText}" has been appropriately translated considering context and meaning in "${translatedText}".`
    };
    
    const questionLower = question.toLowerCase();
    
    for (const [key, explanation] of Object.entries(fallbacks)) {
      if (questionLower.includes(key)) {
        return explanation;
      }
    }
    
    return `I'd be happy to help explain the translation "${originalText}" → "${translatedText}". Could you be more specific about what aspect you'd like to learn about? For example: grammar, word usage, articles, or verb tenses.`;
  }

  // Quick grammar tips for common questions
  getQuickTips(language) {
    const tips = {
      'de': [
        'German nouns are capitalized and have gender (der/die/das)',
        'Verb position: finite verb is second in main clauses',
        'Adjective endings change based on case, gender, and article',
        'Separable verbs split in main clauses (ich stehe auf)',
        'Use "Sie" for formal "you", "du" for informal'
      ],
      'en': [
        'English word order: Subject-Verb-Object (SVO)',
        'Articles: "a/an" for indefinite, "the" for definite',
        'Past tense: regular verbs add -ed, irregular verbs vary',
        'Present perfect: have/has + past participle',
        'Adjectives come before nouns (big house)'
      ]
    };
    
    return tips[language] || [];
  }

  // Get suggested questions based on translation
  getSuggestedQuestions(translationContext) {
    const { sourceLanguage, targetLanguage, originalText, translatedText } = translationContext;
    
    const suggestions = [
      `What is the grammar structure of "${originalText}"?`,
      `Why was "${originalText}" translated as "${translatedText}"?`,
      `What are the verb tenses used in this sentence?`,
      `Can you explain the word order in this translation?`,
      `What articles are used and why?`
    ];

    // Add language-specific suggestions
    if (targetLanguage === 'de') {
      suggestions.push(
        `What is the gender of the nouns in "${translatedText}"?`,
        `What case are the nouns in this German sentence?`,
        `How do the adjective endings work here?`
      );
    }

    if (sourceLanguage === 'de') {
      suggestions.push(
        `How do German separable verbs work in this sentence?`,
        `What's the difference between formal and informal "you" here?`
      );
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  // Clear old translations (cleanup)
  clearOldTranslations(olderThanHours = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);
    
    for (const [userId, translations] of this.recentTranslations.entries()) {
      const filteredTranslations = translations.filter(t => 
        new Date(t.timestamp) > cutoffTime
      );
      
      if (filteredTranslations.length === 0) {
        this.recentTranslations.delete(userId);
      } else {
        this.recentTranslations.set(userId, filteredTranslations);
      }
    }
  }

  // Fast teaching explanation using pre-built grammar rules
  async generateFastTeachingExplanation(text, sourceLanguage, targetLanguage) {
    const startTime = Date.now();
    
    try {
      console.log(`⚡ Generating fast teaching explanation for: "${text}"`);
      
      // Use FastGrammarService for instant analysis
      const analysis = this.fastGrammarService.analyzeText(text, sourceLanguage);
      
      const responseTime = Date.now() - startTime;
      console.log(`✅ Fast teaching generated in ${responseTime}ms`);
      
      return {
        grammar: analysis.grammar,
        tense: analysis.tense,
        articles: analysis.articles,
        usage: analysis.usage,
        words: analysis.words,
        responseTime: responseTime,
        source: 'fast-analysis'
      };
      
    } catch (error) {
      console.error('Fast teaching error:', error);
      return this.getFastFallbackExplanation(text, sourceLanguage, targetLanguage);
    }
  }

  // Comprehensive teaching explanation (fast + detailed if needed)
  async generateComprehensiveExplanation(text, sourceLanguage, targetLanguage, question = null) {
    const startTime = Date.now();
    
    try {
      // Always start with fast analysis for immediate response
      const fastAnalysis = await this.generateFastTeachingExplanation(text, sourceLanguage, targetLanguage);
      
      // If user asked a specific question or wants detailed analysis, use Ollama as enhancement
      if (question && question.length > 10 && this.useFastMode === false) {
        console.log('🤖 Enhancing with detailed Ollama analysis...');
        
        try {
          const translationContext = {
            originalText: text,
            translatedText: '', // May not be available
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage
          };
          
          const detailedExplanation = await this.generateTeachingExplanation(question, translationContext);
          
          // Combine fast and detailed analysis
          return {
            ...fastAnalysis,
            detailedExplanation: detailedExplanation,
            source: 'fast+detailed'
          };
          
        } catch (error) {
          console.warn('Detailed analysis failed, using fast analysis only:', error);
          return fastAnalysis;
        }
      }
      
      return fastAnalysis;
      
    } catch (error) {
      console.error('Comprehensive explanation error:', error);
      return this.getFastFallbackExplanation(text, sourceLanguage, targetLanguage);
    }
  }

  getFastFallbackExplanation(text, sourceLanguage, targetLanguage) {
    console.log('🚨 Using fast fallback explanation');
    
    return {
      grammar: `📝 ${sourceLanguage === 'de' ? 'German' : 'English'} sentence structure - standard word order for this language`,
      tense: `⏰ Current context - expressing information in present timeframe`,
      articles: `📚 Standard article usage for ${sourceLanguage === 'de' ? 'German (der/die/das system)' : 'English (a/an/the system)'}`,
      usage: `💬 General conversational expression - appropriate for everyday communication`,
      words: text.split(' ').slice(0, 5).map((word, index) => ({
        word: word.replace(/[.,!?;:]/g, ''),
        type: 'word',
        meaning: `word ${index + 1}`,
        note: 'basic vocabulary'
      })),
      responseTime: 50,
      source: 'fast-fallback'
    };
  }
}
