import { Ollama } from 'ollama';
import axios from 'axios';

export class OllamaService {
  constructor() {
    this.ollama = new Ollama({
      host: process.env.OLLAMA_HOST || 'http://localhost:11434'
    });
    this.model = process.env.OLLAMA_MODEL || 'deepseek-r1:8b';
    this.initialized = false;
    
    console.log(`🤖 Initializing Ollama service with model: ${this.model}`);
    this.checkOllamaAvailability();
  }

  async checkOllamaAvailability() {
    try {
      const response = await axios.get(`${this.ollama.config.host}/api/tags`);
      const models = response.data.models || [];
      
      const modelExists = models.some(m => m.name === this.model);
      
      if (!modelExists) {
        console.warn(`⚠️  Model ${this.model} not found. Available models:`, models.map(m => m.name));
        console.log(`📥 Attempting to pull model ${this.model}...`);
        await this.pullModel();
      } else {
        console.log(`✅ Model ${this.model} is available`);
        this.initialized = true;
      }
    } catch (error) {
      console.error('❌ Ollama server not available:', error.message);
      console.log('💡 Please ensure Ollama is running: ollama serve');
      console.log('💡 And pull the required model: ollama pull deepseek-r1:8b');
    }
  }

  async pullModel() {
    try {
      console.log(`📥 Pulling model ${this.model}... This may take a while.`);
      
      const response = await axios.post(`${this.ollama.config.host}/api/pull`, {
        name: this.model,
        stream: false
      });
      
      if (response.status === 200) {
        console.log(`✅ Model ${this.model} pulled successfully`);
        this.initialized = true;
      }
    } catch (error) {
      console.error(`❌ Failed to pull model ${this.model}:`, error.message);
      throw new Error(`Model ${this.model} not available and failed to pull`);
    }
  }

  async translateText(text, sourceLanguage, targetLanguage) {
    if (!this.initialized) {
      throw new Error('Ollama service not initialized');
    }

    try {
      const sourceLang = sourceLanguage === 'en' ? 'English' : 'German';
      const targetLang = targetLanguage === 'en' ? 'English' : 'German';
      
      const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. Provide only the translation, no explanations or additional text.

Text to translate: "${text}"

Translation:`;

      const response = await this.ollama.generate({
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          num_predict: 200
        }
      });

      const translation = response.response.trim();
      
      // Clean up the response - remove any quotes or extra formatting
      return translation.replace(/^["']|["']$/g, '').trim();
      
    } catch (error) {
      console.error('Ollama translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  async speechToText(audioBuffer, language) {
    // Note: Ollama doesn't have built-in speech-to-text
    // We'll need to use a different approach or Web Speech API
    throw new Error('Speech-to-text not available with Ollama. Using Web Speech API fallback.');
  }

  async textToSpeech(text, language) {
    // Note: Ollama doesn't have built-in text-to-speech
    // We'll use Web Speech API or return empty buffer for client-side TTS
    return Buffer.alloc(0);
  }

  async generateResponse(prompt, options = {}) {
    if (!this.initialized) {
      throw new Error('Ollama service not initialized');
    }

    try {
      const response = await this.ollama.generate({
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          num_predict: options.max_tokens || 150,
          ...options
        }
      });

      return response.response.trim();
    } catch (error) {
      console.error('Ollama generation error:', error);
      throw new Error(`Generation failed: ${error.message}`);
    }
  }

  isAvailable() {
    return this.initialized;
  }

  getModelInfo() {
    return {
      name: this.model,
      host: this.ollama.config.host,
      available: this.initialized
    };
  }
}
