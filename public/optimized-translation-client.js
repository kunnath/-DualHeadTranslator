/**
 * Optimized Translation Client for Dual Headset System
 * Addresses Performance Issue #3: Network Latency
 * - Implements debouncing for rapid speech inputs
 * - Reduces duplicate requests
 * - Provides immediate user feedback
 * - Manages translation queue efficiently
 */
class OptimizedTranslationClient {
  constructor(socket, roomId, userLanguage) {
    this.socket = socket;
    this.roomId = roomId;
    this.userLanguage = userLanguage;
    
    // Performance optimization settings
    this.debounceDelay = 300; // 300ms debounce for speech input
    this.maxQueueSize = 3; // Maximum queued translations
    this.requestTimeout = 5000; // 5 second timeout for translation requests
    
    // State management
    this.translationQueue = [];
    this.isProcessing = false;
    this.lastTranslationText = '';
    this.lastTranslationTime = 0;
    this.debounceTimer = null;
    this.pendingRequests = new Map();
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0,
      cacheHits: 0,
      errors: 0
    };
    
    // Initialize event listeners
    this.initializeSocketListeners();
    
    console.log('🚀 OptimizedTranslationClient initialized');
  }

  // Optimized speech result handler with debouncing
  handleSpeechResult(transcript, confidence = 1.0) {
    // Clear existing debounce timer
    clearTimeout(this.debounceTimer);
    
    // Skip if transcript is empty or too similar to last translation
    if (!transcript || transcript.trim().length === 0) {
      return;
    }
    
    const cleanTranscript = transcript.trim().toLowerCase();
    const now = Date.now();
    
    // Skip duplicate or very similar translations within short time frame
    if (cleanTranscript === this.lastTranslationText && 
        (now - this.lastTranslationTime) < 2000) {
      console.log('⏭️  Skipping duplicate translation');
      return;
    }
    
    // Show immediate feedback
    this.showTranslationStatus('Processing...', 'processing');
    
    // Debounce rapid speech inputs
    this.debounceTimer = setTimeout(() => {
      this.processTranslation(transcript, confidence);
    }, this.debounceDelay);
  }

  async processTranslation(text, confidence = 1.0) {
    const startTime = Date.now();
    const cleanText = text.trim();
    
    // Update last translation tracking
    this.lastTranslationText = cleanText.toLowerCase();
    this.lastTranslationTime = startTime;
    
    // If already processing, add to queue (with limit)
    if (this.isProcessing) {
      if (this.translationQueue.length < this.maxQueueSize) {
        this.translationQueue.push({ text: cleanText, confidence, timestamp: startTime });
        this.showTranslationStatus(`Queued (${this.translationQueue.length})`, 'queued');
      } else {
        console.warn('⚠️  Translation queue full, dropping request');
        this.showTranslationStatus('Queue full', 'error');
      }
      return;
    }

    this.isProcessing = true;
    this.metrics.totalRequests++;
    
    try {
      // Show processing status
      this.showTranslationStatus('Translating...', 'processing');
      
      // Create unique request ID
      const requestId = `req_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Set up timeout for the request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Translation timeout')), this.requestTimeout);
      });
      
      // Create translation promise
      const translationPromise = new Promise((resolve, reject) => {
        // Set up one-time listeners for this specific request
        const successHandler = (response) => {
          if (response.originalText.trim().toLowerCase() === cleanText.toLowerCase()) {
            resolve(response);
          }
        };
        
        const errorHandler = (error) => {
          reject(new Error(error.error || 'Translation failed'));
        };
        
        // Add temporary listeners
        this.socket.once('text-echo', successHandler);
        this.socket.once('translation-error', errorHandler);
        
        // Send translation request
        this.socket.emit('text-translation', {
          text: cleanText,
          roomId: this.roomId,
          timestamp: startTime,
          requestId: requestId,
          confidence: confidence
        });
        
        // Store request for cleanup
        this.pendingRequests.set(requestId, {
          successHandler,
          errorHandler,
          startTime
        });
      });
      
      // Race between translation and timeout
      const result = await Promise.race([translationPromise, timeoutPromise]);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, true);
      
      // Show success status
      this.showTranslationStatus(
        `Translated (${responseTime}ms)`, 
        result.performance?.cached ? 'cached' : 'success'
      );
      
      // Update UI with translation result
      this.displayTranslationResult(result, responseTime);
      
      // Clean up
      this.pendingRequests.delete(requestId);
      
    } catch (error) {
      console.error('Translation error:', error);
      this.metrics.errors++;
      this.showTranslationStatus(`Error: ${error.message}`, 'error');
      
      // Display error in UI
      this.displayTranslationError(error, cleanText);
      
    } finally {
      this.isProcessing = false;
      
      // Process next item in queue
      setTimeout(() => {
        this.processQueue();
      }, 100);
    }
  }

  processQueue() {
    if (this.translationQueue.length > 0 && !this.isProcessing) {
      // Process only the most recent translation in queue
      const latestTranslation = this.translationQueue.pop();
      this.translationQueue = []; // Clear the rest of the queue
      
      console.log(`📤 Processing queued translation: "${latestTranslation.text}"`);
      this.processTranslation(latestTranslation.text, latestTranslation.confidence);
    }
  }

  showTranslationStatus(message, type = 'info') {
    const statusElement = document.getElementById('translationStatus');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `translation-status ${type}`;
      
      // Auto-clear status after a delay
      if (type !== 'processing' && type !== 'queued') {
        setTimeout(() => {
          statusElement.textContent = '';
          statusElement.className = 'translation-status';
        }, 3000);
      }
    }
    
    // Also log to console for debugging
    console.log(`🔄 Translation Status: ${message} (${type})`);
  }

  displayTranslationResult(result, responseTime) {
    // Update original text display
    const originalElement = document.getElementById('originalText');
    if (originalElement) {
      originalElement.textContent = result.originalText;
    }
    
    // Update performance indicator
    const perfElement = document.getElementById('performanceIndicator');
    if (perfElement) {
      const isFast = responseTime < 500;
      const isCached = result.performance?.cached;
      
      perfElement.textContent = isCached ? '⚡ Cached' : 
                                isFast ? '🚀 Fast' : '🔄 Normal';
      perfElement.className = `performance-indicator ${isCached ? 'cached' : isFast ? 'fast' : 'normal'}`;
    }
    
    // Update metrics display
    this.updateMetricsDisplay();
  }

  displayTranslationError(error, originalText) {
    const originalElement = document.getElementById('originalText');
    if (originalElement) {
      originalElement.textContent = `❌ ${originalText}`;
    }
    
    // Show error in translation area
    const translatedElement = document.getElementById('translatedText');
    if (translatedElement) {
      translatedElement.textContent = `Error: ${error.message}`;
    }
  }

  updateMetrics(responseTime, success) {
    if (success) {
      this.metrics.successfulRequests++;
    }
    
    // Update average response time
    const total = this.metrics.successfulRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (total - 1) + responseTime) / total;
  }

  updateMetricsDisplay() {
    const metricsElement = document.getElementById('performanceMetrics');
    if (metricsElement) {
      const successRate = this.metrics.totalRequests > 0 ? 
        Math.round((this.metrics.successfulRequests / this.metrics.totalRequests) * 100) : 0;
      
      metricsElement.innerHTML = `
        <div class="metric">Success Rate: ${successRate}%</div>
        <div class="metric">Avg Response: ${Math.round(this.metrics.averageResponseTime)}ms</div>
        <div class="metric">Total Requests: ${this.metrics.totalRequests}</div>
        <div class="metric">Errors: ${this.metrics.errors}</div>
      `;
    }
  }

  initializeSocketListeners() {
    // Listen for translated text from other users
    this.socket.on('translated-text', (data) => {
      console.log('📨 Received translation from peer:', data);
      
      // Display received translation
      const translatedElement = document.getElementById('translatedText');
      if (translatedElement) {
        translatedElement.textContent = data.translatedText;
      }
      
      // Show notification
      this.showNotification(`Received: ${data.translatedText}`, 'received');
      
      // Trigger text-to-speech if enabled
      if (window.speechSynthesis && document.getElementById('enableTTS')?.checked) {
        this.speakText(data.translatedText);
      }
    });
    
    // Handle connection issues
    this.socket.on('disconnect', () => {
      this.showTranslationStatus('Disconnected', 'error');
    });
    
    this.socket.on('connect', () => {
      this.showTranslationStatus('Connected', 'success');
    });
  }

  showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.id = 'notificationContainer';
      notificationContainer.className = 'notification-container';
      document.body.appendChild(notificationContainer);
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  speakText(text) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.userLanguage === 'en' ? 'en-US' : 'de-DE';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      speechSynthesis.speak(utterance);
    }
  }

  // Method to get current performance statistics
  getPerformanceStats() {
    return {
      ...this.metrics,
      queueSize: this.translationQueue.length,
      isProcessing: this.isProcessing,
      pendingRequests: this.pendingRequests.size
    };
  }

  // Method to clear the translation queue
  clearQueue() {
    this.translationQueue = [];
    this.showTranslationStatus('Queue cleared', 'info');
  }

  // Method to adjust debounce delay based on speech confidence
  adjustDebounceDelay(confidence) {
    // Lower debounce for higher confidence speech
    this.debounceDelay = confidence > 0.8 ? 200 : 
                        confidence > 0.6 ? 300 : 500;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptimizedTranslationClient;
}
