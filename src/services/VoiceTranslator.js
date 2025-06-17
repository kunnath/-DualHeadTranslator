import { OllamaService } from './OllamaService.js';

export class VoiceTranslator {
  constructor() {
    // Initialize Ollama service for translation
    this.ollamaService = new OllamaService();
    this.useWebSpeechAPI = true; // Always use Web Speech API for STT/TTS
    
    console.log('🎤 VoiceTranslator initialized with Ollama backend');
  }

  /**
   * Convert speech to text using Web Speech API (client-side)
   * Note: With Ollama, we rely on client-side speech recognition
   */
  async speechToText(audioBuffer, language = 'en') {
    try {
      // Since Ollama doesn't have STT, we'll throw an error to force client-side processing
      throw new Error('Server-side STT not available with Ollama. Using client-side Web Speech API.');
    } catch (error) {
      console.error('Speech to text error:', error);
      throw new Error('Failed to convert speech to text - using client-side fallback');
    }
  }

  /**
   * Convert text to speech using Web Speech API (client-side)
   * Note: With Ollama, we rely on client-side speech synthesis
   */
  async textToSpeech(text, language = 'en') {
    try {
      // Return empty buffer for client-side TTS
      console.log(`🔊 Text-to-speech: "${text}" (${language}) - using client-side synthesis`);
      return Buffer.alloc(0);
    } catch (error) {
      console.error('Text to speech error:', error);
      throw new Error('Failed to convert text to speech');
    }
  }

  /**
   * Process audio stream for real-time dual headset translation using Ollama
   */
  async processAudioStream(audioData, sourceLanguage, targetLanguage) {
    try {
      // Since we're using Ollama for translation only, we need the text input
      // This method will be called with transcribed text from client-side STT
      const originalText = audioData; // Assume audioData is already transcribed text
      
      // Validate text input
      if (!originalText || originalText.trim().length === 0) {
        throw new Error('No text provided for translation');
      }
      
      console.log(`🔄 Processing text: "${originalText}" (${sourceLanguage} -> ${targetLanguage})`);
      
      // Use Ollama for translation
      const translatedText = await this.ollamaService.translateText(
        originalText.trim(), 
        sourceLanguage, 
        targetLanguage
      );
      
      console.log(`✅ Translated: "${translatedText}"`);
      
      // Return empty audio buffer since we're using client-side TTS
      return {
        originalText: originalText.trim(),
        translatedText: translatedText.trim(),
        audioBase64: '', // Empty for client-side TTS
        success: true,
        timestamp: Date.now(),
        sourceLanguage,
        targetLanguage
      };
    } catch (error) {
      console.error('Audio stream processing error:', error);
      
      // Return more specific error information
      const errorMessage = error.message || 'Unknown processing error';
      throw new Error(`Ollama processing failed: ${errorMessage}`);
    }
  }

  /**
   * Process text-only translation (new method for Ollama)
   */
  async processTextTranslation(text, sourceLanguage, targetLanguage) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('No text provided for translation');
      }
      
      console.log(`🔄 Translating: "${text}" (${sourceLanguage} -> ${targetLanguage})`);
      
      const translatedText = await this.ollamaService.translateText(
        text.trim(), 
        sourceLanguage, 
        targetLanguage
      );
      
      console.log(`✅ Translation result: "${translatedText}"`);
      
      return {
        originalText: text.trim(),
        translatedText: translatedText.trim(),
        success: true,
        timestamp: Date.now(),
        sourceLanguage,
        targetLanguage
      };
    } catch (error) {
      console.error('Text translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return {
      'en': 'English',
      'de': 'German'
    };
  }
}
