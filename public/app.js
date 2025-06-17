class VoiceTranslatorApp {
    constructor() {
        this.socket = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.currentSourceLanguage = 'en';
        this.currentTargetLanguage = 'de';
        this.roomId = this.generateRoomId();
        this.conversationHistory = [];
        
        this.init();
    }

    async init() {
        await this.initializeSocketConnection();
        this.setupEventListeners();
        this.setupWebSpeechAPI();
        this.updateUI();
        this.joinRoom();
    }

    async initializeSocketConnection() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                this.updateConnectionStatus('connected');
                console.log('Connected to server');
            });

            this.socket.on('disconnect', () => {
                this.updateConnectionStatus('disconnected');
                console.log('Disconnected from server');
            });

            this.socket.on('translated-audio', (data) => {
                this.handleIncomingTranslation(data);
            });

            this.socket.on('translation-error', (error) => {
                this.showError('Translation error: ' + error.error);
                this.hideLoading();
            });

        } catch (error) {
            console.error('Socket initialization failed:', error);
            this.updateConnectionStatus('disconnected');
        }
    }

    setupEventListeners() {
        // Language selection
        const languageRadios = document.querySelectorAll('input[name="sourceLanguage"]');
        languageRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.handleLanguageChange(radio.value);
            });
        });

        // Swap languages button
        document.getElementById('swapLanguages').addEventListener('click', () => {
            this.swapLanguages();
        });

        // Record button
        const recordBtn = document.getElementById('recordBtn');
        recordBtn.addEventListener('mousedown', () => this.startRecording());
        recordBtn.addEventListener('mouseup', () => this.stopRecording());
        recordBtn.addEventListener('mouseleave', () => this.stopRecording());
        recordBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording();
        });
        recordBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });

        // Play buttons
        document.getElementById('playInputBtn').addEventListener('click', () => {
            this.playText(document.getElementById('inputText').textContent, this.currentSourceLanguage);
        });

        document.getElementById('playOutputBtn').addEventListener('click', () => {
            this.playText(document.getElementById('outputText').textContent, this.currentTargetLanguage);
        });

        // Clear history
        document.getElementById('clearHistoryBtn').addEventListener('click', () => {
            this.clearHistory();
        });

        // Copy room code
        document.getElementById('copyRoomBtn').addEventListener('click', () => {
            this.copyRoomCode();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                this.startRecording();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.stopRecording();
            }
        });
    }

    setupWebSpeechAPI() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = false;
        this.speechRecognition.interimResults = true;

        this.speechRecognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            
            document.getElementById('inputText').textContent = transcript;
            
            if (event.results[event.results.length - 1].isFinal) {
                this.translateText(transcript);
            }
        };

        this.speechRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.showError('Speech recognition error: ' + event.error);
            this.stopRecording();
        };

        this.speechRecognition.onend = () => {
            this.stopRecording();
        };

        // Text-to-Speech setup
        this.speechSynthesis = window.speechSynthesis;
    }

    handleLanguageChange(sourceLanguage) {
        this.currentSourceLanguage = sourceLanguage;
        this.currentTargetLanguage = sourceLanguage === 'en' ? 'de' : 'en';
        this.updateUI();
    }

    swapLanguages() {
        const temp = this.currentSourceLanguage;
        this.currentSourceLanguage = this.currentTargetLanguage;
        this.currentTargetLanguage = temp;
        
        // Update radio buttons
        document.getElementById(this.currentSourceLanguage === 'en' ? 'englishFirst' : 'germanFirst').checked = true;
        
        this.updateUI();
    }

    updateUI() {
        const languages = {
            'en': { name: 'English', flag: '🇺🇸' },
            'de': { name: 'German', flag: '🇩🇪' }
        };

        const sourceLang = languages[this.currentSourceLanguage];
        const targetLang = languages[this.currentTargetLanguage];

        // Update labels and flags
        document.getElementById('inputLanguageLabel').innerHTML = `
            <span class="flag" id="inputFlag">${sourceLang.flag}</span>
            Speak in ${sourceLang.name}
        `;

        document.getElementById('outputLanguageLabel').innerHTML = `
            <span class="flag" id="outputFlag">${targetLang.flag}</span>
            ${targetLang.name} Translation
        `;

        // Update speech recognition language
        if (this.speechRecognition) {
            this.speechRecognition.lang = this.currentSourceLanguage === 'en' ? 'en-US' : 'de-DE';
        }

        // Clear previous text
        document.getElementById('inputText').textContent = `Press and hold the microphone button to start speaking in ${sourceLang.name}...`;
        document.getElementById('outputText').textContent = `${targetLang.name} translation will appear here...`;
    }

    async startRecording() {
        if (this.isRecording) return;

        try {
            this.isRecording = true;
            const recordBtn = document.getElementById('recordBtn');
            recordBtn.classList.add('recording');
            recordBtn.innerHTML = '<i class="fas fa-stop"></i><span>Recording...</span>';

            document.getElementById('inputText').textContent = 'Listening...';

            // Start speech recognition if available
            if (this.speechRecognition) {
                this.speechRecognition.start();
            }

            // Also start audio recording for server processing
            await this.startAudioRecording();

        } catch (error) {
            console.error('Recording start error:', error);
            this.showError('Failed to start recording: ' + error.message);
            this.stopRecording();
        }
    }

    async startAudioRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecordedAudio();
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();

        } catch (error) {
            console.error('Audio recording setup failed:', error);
            throw error;
        }
    }

    stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;
        const recordBtn = document.getElementById('recordBtn');
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Hold to Speak</span>';

        // Stop speech recognition
        if (this.speechRecognition) {
            this.speechRecognition.stop();
        }

        // Stop media recorder
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    }

    async processRecordedAudio() {
        if (this.audioChunks.length === 0) return;

        try {
            this.showLoading();

            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('sourceLanguage', this.currentSourceLanguage);
            formData.append('targetLanguage', this.currentTargetLanguage);

            const response = await fetch('/api/translate-audio', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.displayTranslation(result);
                this.addToHistory(result.originalText, result.translatedText);
                
                // Play translated audio
                if (result.audioBase64) {
                    this.playAudioFromBase64(result.audioBase64);
                }
            } else {
                this.showError('Translation failed: ' + result.error);
            }

        } catch (error) {
            console.error('Audio processing error:', error);
            this.showError('Failed to process audio: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async translateText(text) {
        if (!text.trim()) return;

        try {
            this.showLoading();

            const response = await fetch('/api/translate-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    sourceLanguage: this.currentSourceLanguage,
                    targetLanguage: this.currentTargetLanguage
                })
            });

            const result = await response.json();

            if (result.success) {
                this.displayTranslation({
                    originalText: text,
                    translatedText: result.translatedText
                });
                this.addToHistory(text, result.translatedText);
                
                // Use text-to-speech for translation
                this.speakText(result.translatedText, this.currentTargetLanguage);
            }

        } catch (error) {
            console.error('Text translation error:', error);
            this.showError('Translation failed: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    displayTranslation(result) {
        document.getElementById('inputText').textContent = result.originalText;
        document.getElementById('outputText').textContent = result.translatedText;

        // Enable play buttons
        document.getElementById('playInputBtn').disabled = false;
        document.getElementById('playOutputBtn').disabled = false;
    }

    speakText(text, language) {
        if (!this.speechSynthesis || !text) return;

        // Cancel any ongoing speech
        this.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === 'en' ? 'en-US' : 'de-DE';
        utterance.rate = 0.9;
        utterance.pitch = 1;

        // Find appropriate voice
        const voices = this.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(language === 'en' ? 'en' : 'de'));
        if (voice) {
            utterance.voice = voice;
        }

        utterance.onstart = () => {
            this.showAudioVisualizer();
        };

        utterance.onend = () => {
            this.hideAudioVisualizer();
        };

        this.speechSynthesis.speak(utterance);
    }

    playText(text, language) {
        this.speakText(text, language);
    }

    playAudioFromBase64(base64Audio) {
        try {
            const audioPlayer = document.getElementById('audioPlayer');
            const audioBlob = new Blob([
                Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))
            ], { type: 'audio/mp3' });
            
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioUrl;

            audioPlayer.onplay = () => {
                this.showAudioVisualizer();
            };

            audioPlayer.onended = () => {
                this.hideAudioVisualizer();
                URL.revokeObjectURL(audioUrl);
            };

            audioPlayer.play();

        } catch (error) {
            console.error('Audio playback error:', error);
            this.showError('Failed to play audio');
        }
    }

    showAudioVisualizer() {
        document.getElementById('audioVisualizer').classList.add('active');
    }

    hideAudioVisualizer() {
        document.getElementById('audioVisualizer').classList.remove('active');
    }

    addToHistory(originalText, translatedText) {
        const historyItem = {
            id: Date.now(),
            timestamp: new Date(),
            originalText,
            translatedText,
            sourceLanguage: this.currentSourceLanguage,
            targetLanguage: this.currentTargetLanguage
        };

        this.conversationHistory.unshift(historyItem);
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyList = document.getElementById('historyList');
        
        if (this.conversationHistory.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>Start a conversation to see history</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = this.conversationHistory.map(item => `
            <div class="history-item">
                <div class="history-item-header">
                    <span>${this.formatTime(item.timestamp)}</span>
                    <span>${this.getLanguageName(item.sourceLanguage)} → ${this.getLanguageName(item.targetLanguage)}</span>
                </div>
                <div class="history-item-content">
                    <div class="history-original">${item.originalText}</div>
                    <div class="history-translation">${item.translatedText}</div>
                </div>
            </div>
        `).join('');
    }

    clearHistory() {
        this.conversationHistory = [];
        this.updateHistoryDisplay();
    }

    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    getLanguageName(code) {
        return code === 'en' ? 'English' : 'German';
    }

    joinRoom() {
        if (this.socket) {
            this.socket.emit('join-room', this.roomId);
        }
        document.getElementById('roomCodeInput').value = this.roomId;
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    copyRoomCode() {
        const roomCodeInput = document.getElementById('roomCodeInput');
        roomCodeInput.select();
        document.execCommand('copy');
        
        const copyBtn = document.getElementById('copyRoomBtn');
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
        }, 2000);
    }

    handleIncomingTranslation(data) {
        // Display received translation
        this.displayTranslation({
            originalText: data.translatedText, // Show their translation as input
            translatedText: data.originalText   // Show their original as output
        });

        // Play the translated audio
        if (data.audioBase64) {
            this.playAudioFromBase64(data.audioBase64);
        }

        // Add to history
        this.addToHistory(data.originalText, data.translatedText);
    }

    updateConnectionStatus(status) {
        const statusIcon = document.getElementById('statusIcon');
        const statusText = document.getElementById('statusText');
        const connectionStatus = document.getElementById('connectionStatus');

        connectionStatus.className = 'connection-status ' + status;

        switch (status) {
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                break;
        }
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('show');
    }

    showError(message) {
        const errorToast = document.getElementById('errorToast');
        const errorMessage = document.getElementById('errorMessage');
        
        errorMessage.textContent = message;
        errorToast.classList.add('show');

        setTimeout(() => {
            errorToast.classList.remove('show');
        }, 5000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VoiceTranslatorApp();
});
