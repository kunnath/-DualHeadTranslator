class DualHeadsetTranslator {
    constructor() {
        this.socket = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isTalking = false;
        this.userLanguage = 'en';
        this.deviceType = 'headset';
        this.roomId = null;
        this.isConnected = false;
        this.peerConnected = false;
        this.conversationHistory = [];
        this.audioContext = null;
        this.microphone = null;
        this.voiceActivityDetector = null;
        this.isMuted = false;
        this.volume = 0.8;
        this.autoPlay = true;
        this.deviceInfo = {
            headsetConnected: true,
            batteryLevel: 85
        };
        
        // Web Speech API for STT
        this.recognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.isListening = false;
        
        this.init();
    }

    async init() {
        // Check browser compatibility first
        this.checkBrowserCompatibility();
        
        this.setupEventListeners();
        await this.initializeAudio();
        this.initializeWebSpeechAPI();
        this.generateRoomCode();
        this.updateUI();
        this.setupRoomCodeValidation();
        this.addConnectionVisualization();
        this.enhanceStartSessionButton();
    }

    checkBrowserCompatibility() {
        const issues = [];
        
        // Check for basic APIs
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            issues.push('getUserMedia API not supported');
        }
        
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            issues.push('Speech Recognition API not supported');
        }
        
        if (!window.speechSynthesis) {
            issues.push('Speech Synthesis API not supported');
        }
        
        if (!window.WebSocket) {
            issues.push('WebSocket not supported');
        }
        
        // Check if running on HTTPS (required for some APIs)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            issues.push('HTTPS required for microphone access (except on localhost)');
        }
        
        if (issues.length > 0) {
            console.warn('Browser compatibility issues:', issues);
            this.showError(`Browser compatibility issues: ${issues.join(', ')}. Please use a modern browser like Chrome, Firefox, or Safari.`);
        } else {
            console.log('✅ Browser compatibility check passed');
        }
    }

    initializeWebSpeechAPI() {
        // Check for Web Speech API support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('⚠️  Web Speech API not supported in this browser');
            this.showError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
            return false;
        }

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            // Configuration for better reliability
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.maxAlternatives = 3; // Get multiple alternatives
            
            // Set initial language
            this.updateSpeechRecognitionLanguage();
            
            // Event handlers
            this.recognition.onstart = () => {
                console.log('🎤 Speech recognition started');
                this.isListening = true;
                this.updateTalkButtonState('listening');
                this.showSuccess('Listening... Speak now!');
            };
            
            this.recognition.onresult = (event) => {
                if (event.results && event.results.length > 0) {
                    const result = event.results[0];
                    const transcript = result[0].transcript;
                    const confidence = result[0].confidence;
                    
                    console.log('🎯 Speech recognized:', transcript, 'Confidence:', confidence);
                    
                    // Use the result even with low confidence, but inform user
                    if (confidence < 0.5) {
                        this.showWarning(`Speech detected with low confidence: "${transcript}"`);
                    }
                    
                    this.handleSpeechResult(transcript);
                } else {
                    console.warn('No speech results received');
                    this.showError('No speech detected. Please try again and speak clearly.');
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error, event);
                this.isListening = false;
                this.isTalking = false;
                
                // Handle specific errors with actionable advice
                switch(event.error) {
                    case 'not-allowed':
                        this.showError('❌ Microphone access denied. Please:\n1. Allow microphone access in browser settings\n2. Reload the page\n3. Try again');
                        this.updateTalkButtonState('error');
                        break;
                    case 'service-not-allowed':
                        this.showError('❌ Speech service blocked. Please:\n1. Check browser privacy settings\n2. Ensure you\'re on HTTPS or localhost\n3. Try a different browser');
                        this.updateTalkButtonState('error');
                        break;
                    case 'network':
                        this.showError('❌ Network error. Please check your internet connection and try again.');
                        this.updateTalkButtonState('error');
                        break;
                    case 'no-speech':
                        this.showWarning('⚠️ No speech detected. Please speak louder and try again.');
                        this.updateTalkButtonState('ready');
                        break;
                    case 'aborted':
                        console.log('Speech recognition aborted by user');
                        this.updateTalkButtonState('ready');
                        break;
                    case 'audio-capture':
                        this.showError('❌ Audio capture failed. Please:\n1. Check if microphone is connected\n2. Ensure no other app is using the microphone\n3. Try again');
                        this.updateTalkButtonState('error');
                        break;
                    case 'bad-grammar':
                        this.showError('❌ Speech recognition grammar error. Please try again.');
                        this.updateTalkButtonState('ready');
                        break;
                    default:
                        this.showError(`❌ Speech recognition error: ${event.error}. Please try again or refresh the page.`);
                        this.updateTalkButtonState('error');
                }
            };
            
            this.recognition.onend = () => {
                console.log('🛑 Speech recognition ended');
                this.isListening = false;
                this.isTalking = false;
                this.updateTalkButtonState('ready');
            };
            
            // Test the recognition service
            this.testSpeechRecognition();
            
            console.log('✅ Web Speech API initialized successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize Web Speech API:', error);
            this.showError('Failed to initialize speech recognition. Please refresh the page and try again.');
            return false;
        }
    }

    updateSpeechRecognitionLanguage() {
        if (!this.recognition) return;
        
        const lang = this.userLanguage === 'en' ? 'en-US' : 'de-DE';
        this.recognition.lang = lang;
        console.log(`🌐 Speech recognition language set to: ${lang}`);
    }

    async testSpeechRecognition() {
        try {
            // Test microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Stop the test stream
            console.log('✅ Microphone access test passed');
            
            // Test speech recognition service availability
            if (this.recognition) {
                console.log('✅ Speech recognition service available');
                this.showSuccess('Speech recognition ready! Click "Hold to Talk" to start.');
            }
        } catch (error) {
            console.error('Speech recognition test failed:', error);
            if (error.name === 'NotAllowedError') {
                this.showError('❌ Microphone access denied. Please allow microphone access in your browser settings.');
            } else if (error.name === 'NotFoundError') {
                this.showError('❌ No microphone found. Please connect a microphone and reload the page.');
            } else {
                this.showError('❌ Speech recognition setup failed. Please check your microphone and browser settings.');
            }
        }
    }

    updateTalkButtonState(state) {
        const talkBtn = document.getElementById('talkBtn');
        const talkText = talkBtn.querySelector('.talk-text');
        const voiceIndicator = document.getElementById('voiceIndicator');
        
        // Remove all state classes
        talkBtn.classList.remove('active', 'listening', 'error');
        voiceIndicator.classList.remove('active');
        
        switch(state) {
            case 'ready':
                talkText.textContent = 'Hold to Talk';
                break;
            case 'listening':
                talkBtn.classList.add('active', 'listening');
                talkText.textContent = 'Listening...';
                voiceIndicator.classList.add('active');
                break;
            case 'processing':
                talkBtn.classList.add('active');
                talkText.textContent = 'Processing...';
                break;
            case 'error':
                talkBtn.classList.add('error');
                talkText.textContent = 'Error - Try Again';
                setTimeout(() => {
                    this.updateTalkButtonState('ready');
                }, 2000);
                break;
        }
    }

    setupEventListeners() {
        // Setup section event listeners
        document.getElementById('generateRoomBtn').addEventListener('click', () => {
            this.generateRoomCode();
        });

        document.getElementById('pasteRoomBtn').addEventListener('click', () => {
            this.pasteRoomCode();
        });

        document.getElementById('clearRoomBtn').addEventListener('click', () => {
            this.clearRoomCode();
        });

        // Room code input enhancements
        const roomCodeInput = document.getElementById('roomCodeInput');
        let shouldSelectAll = false;
        
        // Auto-format and validate input
        roomCodeInput.addEventListener('input', (e) => {
            let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (value.length > 6) value = value.slice(0, 6);
            e.target.value = value;
        });

        // Only select all text on first click if field is empty or has generated code
        roomCodeInput.addEventListener('mousedown', () => {
            shouldSelectAll = roomCodeInput.value.length === 0 || roomCodeInput.value.length === 6;
        });

        roomCodeInput.addEventListener('click', () => {
            if (shouldSelectAll) {
                roomCodeInput.select();
                shouldSelectAll = false;
            }
        });

        // Select all text when focusing via tab or programmatically, but not on click
        roomCodeInput.addEventListener('focus', (e) => {
            if (e.relatedTarget && shouldSelectAll) {
                setTimeout(() => roomCodeInput.select(), 10);
            }
        });

        // Handle keyboard shortcuts
        roomCodeInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'v') {
                    // Allow paste
                    setTimeout(() => {
                        let value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        if (value.length > 6) value = value.slice(0, 6);
                        roomCodeInput.value = value;
                    }, 10);
                } else if (e.key === 'a') {
                    // Select all
                    e.preventDefault();
                    roomCodeInput.select();
                }
            }
        });

        document.getElementById('startSessionBtn').addEventListener('click', () => {
            this.startSession();
        });

        // Language selection
        document.querySelectorAll('input[name="userLanguage"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.userLanguage = e.target.value;
                this.updateLanguageDisplay();
                this.updateSpeechRecognitionLanguage();
                this.showSuccess(`Language changed to ${e.target.value === 'en' ? 'English' : 'German'}. Speech recognition updated.`);
            });
        });

        // Device type selection
        document.querySelectorAll('input[name="deviceType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.deviceType = e.target.value;
            });
        });

        // Communication section event listeners
        document.getElementById('copyRoomCodeBtn').addEventListener('click', () => {
            this.copyRoomCode();
        });

        document.getElementById('shareRoomBtn').addEventListener('click', () => {
            this.shareRoomCode();
        });

        // Room code display in communication section
        const currentRoomCodeInput = document.getElementById('currentRoomCode');
        if (currentRoomCodeInput) {
            // Select all text when clicking on the room code display
            currentRoomCodeInput.addEventListener('click', () => {
                currentRoomCodeInput.select();
            });

            // Select all text when focusing
            currentRoomCodeInput.addEventListener('focus', () => {
                setTimeout(() => currentRoomCodeInput.select(), 10);
            });
        }

        // Talk button with multiple interaction methods
        const talkBtn = document.getElementById('talkBtn');
        
        // Mouse events
        talkBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.startTalking();
        });
        
        talkBtn.addEventListener('mouseup', () => {
            this.stopTalking();
        });
        
        talkBtn.addEventListener('mouseleave', () => {
            this.stopTalking();
        });

        // Touch events for mobile
        talkBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startTalking();
        });
        
        talkBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopTalking();
        });

        // Keyboard support (spacebar)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.isTalking && this.isConnected) {
                e.preventDefault();
                this.startTalking();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' && this.isTalking) {
                e.preventDefault();
                this.stopTalking();
            }
        });

        // Control buttons
        document.getElementById('muteBtn').addEventListener('click', () => {
            this.toggleMute();
        });

        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettings();
        });

        document.getElementById('leaveSessionBtn').addEventListener('click', () => {
            this.leaveSession();
        });

        document.getElementById('clearConversationBtn').addEventListener('click', () => {
            this.clearConversation();
        });

        // Settings modal
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            this.closeSettings();
        });

        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            this.updateVolume(e.target.value);
        });

        document.getElementById('autoPlayToggle').addEventListener('change', (e) => {
            this.autoPlay = e.target.checked;
        });

        // Toast close buttons
        document.getElementById('closeErrorBtn').addEventListener('click', () => {
            this.hideToast('errorToast');
        });

        document.getElementById('closeSuccessBtn').addEventListener('click', () => {
            this.hideToast('successToast');
        });

        // Click outside modal to close
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.closeSettings();
            }
        });
    }

    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Request microphone permissions early
            console.log('🎤 Requesting microphone permissions...');
            
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.microphone = stream;
            
            // Setup voice activity detection
            this.setupVoiceActivityDetection(stream);
            
            // Get available audio devices
            await this.getAudioDevices();

            console.log('✅ Audio and microphone initialized successfully');
            this.showSuccess('Microphone access granted. You can now use voice translation.');
            
        } catch (error) {
            console.error('Audio initialization failed:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showError('Microphone access denied. Please allow microphone access in your browser settings and refresh the page.');
            } else if (error.name === 'NotFoundError') {
                this.showError('No microphone found. Please connect a microphone and refresh the page.');
            } else {
                this.showError('Failed to initialize audio. Please check your microphone settings and refresh the page.');
            }
        }
    }

    setupVoiceActivityDetection(stream) {
        const analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVoiceActivity = () => {
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const threshold = 20; // Adjust based on environment
            
            const isActive = average > threshold;
            
            if (isActive !== this.voiceActivityDetected) {
                this.voiceActivityDetected = isActive;
                this.updateVoiceIndicator(isActive);
                
                // Notify peers about voice activity
                if (this.socket && this.roomId) {
                    this.socket.emit('voice-activity', {
                        isActive: isActive,
                        roomId: this.roomId
                    });
                }
            }
            
            requestAnimationFrame(checkVoiceActivity);
        };

        checkVoiceActivity();
    }

    async getAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const microphones = devices.filter(device => device.kind === 'audioinput');
            const speakers = devices.filter(device => device.kind === 'audiooutput');

            this.populateDeviceSelects(microphones, speakers);
        } catch (error) {
            console.error('Failed to get audio devices:', error);
        }
    }

    populateDeviceSelects(microphones, speakers) {
        const micSelect = document.getElementById('microphoneSelect');
        const speakerSelect = document.getElementById('speakerSelect');

        // Clear existing options
        micSelect.innerHTML = '<option value="">Default</option>';
        speakerSelect.innerHTML = '<option value="">Default</option>';

        microphones.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${micSelect.children.length}`;
            micSelect.appendChild(option);
        });

        speakers.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Speaker ${speakerSelect.children.length}`;
            speakerSelect.appendChild(option);
        });
    }

    generateRoomCode() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        const input = document.getElementById('roomCodeInput');
        input.value = result;
        
        // Focus and select the generated code for easy copying
        input.focus();
        setTimeout(() => input.select(), 10);
        
        this.showSuccess(`New room code generated: ${result}. Share this code with the other user!`);
        
        return result;
    }

    clearRoomCode() {
        const input = document.getElementById('roomCodeInput');
        input.value = '';
        input.focus();
        this.showSuccess('Room code cleared. You can now enter a new code.');
    }

    updateLanguageDisplay() {
        const flag = this.userLanguage === 'en' ? '🇺🇸' : '🇩🇪';
        const language = this.userLanguage === 'en' ? 'English' : 'German';
        
        document.getElementById('userFlag').textContent = flag;
        document.getElementById('userLanguageText').textContent = `${language} Speaker`;
    }

    async startSession() {
        // Collect user selections
        const roomCodeRaw = document.getElementById('roomCodeInput').value.trim();
        const roomCode = roomCodeRaw.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Get selected language
        const languageRadio = document.querySelector('input[name="userLanguage"]:checked');
        if (languageRadio) {
            this.userLanguage = languageRadio.value;
        } else {
            this.showError('Please select your language (English or German).');
            return;
        }
        
        // Get selected device type
        const deviceRadio = document.querySelector('input[name="deviceType"]:checked');
        if (deviceRadio) {
            this.deviceType = deviceRadio.value;
        } else {
            this.showError('Please select your device type (Wireless Headset or Mobile Device).');
            return;
        }
        
        // Validate room code
        if (!roomCode) {
            this.showError('Please enter a room code or click "Generate" to create a new one.');
            document.getElementById('roomCodeInput').focus();
            return;
        }
        
        if (roomCode.length !== 6) {
            this.showError(`Room code must be exactly 6 characters. Current code "${roomCode}" has ${roomCode.length} characters.`);
            document.getElementById('roomCodeInput').focus();
            document.getElementById('roomCodeInput').select();
            return;
        }

        this.roomId = roomCode;
        
        // Update the input field with the cleaned code
        document.getElementById('roomCodeInput').value = roomCode;
        
        console.log('Starting session with:', {
            roomId: this.roomId,
            userLanguage: this.userLanguage,
            deviceType: this.deviceType
        });
        
        try {
            await this.initializeSocketConnection();
            this.joinRoom();
            this.switchToCommuncationView();
            this.showSuccess(`Connected to room ${roomCode} as ${this.userLanguage === 'en' ? 'English' : 'German'} speaker!`);
        } catch (error) {
            console.error('Failed to start session:', error);
            this.showError('Failed to connect to session. Please try again.');
        }
    }

    async initializeSocketConnection() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = io();
                
                this.socket.on('connect', () => {
                    this.isConnected = true;
                    this.updateConnectionStatus('connected');
                    console.log('Connected to server');
                    resolve();
                });

                this.socket.on('disconnect', () => {
                    this.isConnected = false;
                    this.peerConnected = false;
                    this.updateConnectionStatus('disconnected');
                    console.log('Disconnected from server');
                    this.showError('Connection lost. Please refresh the page and try again.');
                });

                this.socket.on('connect_error', (error) => {
                    console.error('Connection error:', error);
                    this.showError('Failed to connect to server. Please check your connection and try again.');
                    reject(error);
                });

                this.socket.on('room-joined', (data) => {
                    this.handleRoomJoined(data);
                });

                this.socket.on('room-error', (error) => {
                    console.error('Room error:', error);
                    this.showError(`Room error: ${error.message || 'Failed to join room'}`);
                });

                this.socket.on('user-joined', (data) => {
                    this.handleUserJoined(data);
                });

                this.socket.on('user-left', (data) => {
                    this.handleUserLeft(data);
                });

                this.socket.on('translated-audio', (data) => {
                    this.handleIncomingTranslation(data);
                });

                // New handler for text-based translations
                this.socket.on('translated-text', (data) => {
                    this.handleIncomingTextTranslation(data);
                });

                this.socket.on('audio-echo', (data) => {
                    this.handleAudioEcho(data);
                });

                // New handler for text echo
                this.socket.on('text-echo', (data) => {
                    this.handleTextEcho(data);
                });

                this.socket.on('peer-voice-activity', (data) => {
                    this.handlePeerVoiceActivity(data);
                });

                this.socket.on('peer-headset-status', (data) => {
                    this.handlePeerHeadsetStatus(data);
                });

                this.socket.on('translation-error', (error) => {
                    console.error('Translation error received:', error);
                    
                    // Check if it's an API key related error
                    if (error.error && error.error.includes('API key')) {
                        this.showError('Translation service requires setup. Using Web Speech API fallback for translation.');
                        this.showInfo('💡 For better translation quality, configure OpenAI API key on the server.');
                    } else {
                        this.showError('Translation error: ' + (error.error || 'Unknown error'));
                    }
                    
                    this.stopTalking();
                });

                this.socket.on('pong', (data) => {
                    const latency = Date.now() - data.timestamp;
                    console.log(`Latency: ${latency}ms`);
                });

                // Ping every 30 seconds to measure latency
                setInterval(() => {
                    if (this.socket && this.isConnected) {
                        this.socket.emit('ping');
                    }
                }, 30000);

            } catch (error) {
                console.error('Socket initialization failed:', error);
                reject(error);
            }
        });
    }

    joinRoom() {
        if (!this.socket) {
            console.error('Socket not initialized');
            this.showError('Connection not established. Please try again.');
            return;
        }
        
        if (!this.roomId) {
            console.error('Room ID not set');
            this.showError('Room code not set. Please enter a room code.');
            return;
        }
        
        if (!this.userLanguage) {
            console.error('User language not set');
            this.showError('Language not selected. Please select your language.');
            return;
        }
        
        if (!this.deviceType) {
            console.error('Device type not set');
            this.showError('Device type not selected. Please select your device type.');
            return;
        }
        
        console.log('Joining room with data:', {
            roomId: this.roomId,
            userLanguage: this.userLanguage,
            deviceType: this.deviceType
        });
        
        this.socket.emit('join-room', {
            roomId: this.roomId,
            userLanguage: this.userLanguage,
            deviceType: this.deviceType
        });
        
        this.showSuccess(`Joining room ${this.roomId} as ${this.userLanguage === 'en' ? 'English' : 'German'} speaker...`);
    }

    switchToCommuncationView() {
        document.getElementById('setupSection').style.display = 'none';
        document.getElementById('communicationSection').style.display = 'block';
        document.getElementById('currentRoomCode').value = this.roomId;
        this.updateLanguageDisplay();
    }

    handleRoomJoined(data) {
        console.log('Room joined successfully:', data);
        this.showSuccess(`Successfully joined room ${this.roomId}! ${data.totalUsers} user(s) connected.`);
        
        document.getElementById('userCount').textContent = data.totalUsers;
        
        if (data.otherUsers && data.otherUsers.length > 0) {
            this.peerConnected = true;
            this.showPeerPanel(data.otherUsers[0]);
            this.showSuccess('Another user is connected! You can now start talking.');
        } else {
            this.showWarning('Waiting for another user to join the room...');
        }
    }

    handleUserJoined(data) {
        console.log('User joined:', data);
        document.getElementById('userCount').textContent = data.totalUsers;
        
        if (data.language !== this.userLanguage) {
            this.peerConnected = true;
            this.showPeerPanel(data);
            this.showSuccess(`${data.language === 'en' ? 'English' : 'German'} speaker joined the session!`);
        }
    }

    handleUserLeft(data) {
        console.log('User left:', data);
        document.getElementById('userCount').textContent = data.totalUsers;
        
        if (data.language !== this.userLanguage) {
            this.peerConnected = false;
            this.hidePeerPanel();
            this.showError(`${data.language === 'en' ? 'English' : 'German'} speaker left the session.`);
        }
    }

    showPeerPanel(peerData) {
        const peerPanel = document.getElementById('peerPanel');
        const peerFlag = document.getElementById('peerFlag');
        const peerLanguageText = document.getElementById('peerLanguageText');
        
        peerFlag.textContent = peerData.language === 'en' ? '🇺🇸' : '🇩🇪';
        peerLanguageText.textContent = `${peerData.language === 'en' ? 'English' : 'German'} Speaker`;
        
        peerPanel.style.display = 'block';
    }

    hidePeerPanel() {
        document.getElementById('peerPanel').style.display = 'none';
    }

    async startTalking() {
        if (this.isTalking || !this.isConnected) return;
        
        // Check if speech recognition is available
        if (!this.recognition) {
            this.showError('Speech recognition not available. Please refresh the page and ensure you have a compatible browser.');
            return;
        }
        
        // Check if already listening
        if (this.isListening) {
            console.log('Speech recognition already active');
            return;
        }
        
        this.isTalking = true;
        this.updateTalkButtonState('processing');
        
        try {
            // Update language for speech recognition
            this.updateSpeechRecognitionLanguage();
            
            console.log(`🎤 Preparing speech recognition for ${this.userLanguage === 'en' ? 'English' : 'German'}`);
            
            // Ensure microphone permissions
            if (!this.microphone) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        } 
                    });
                    this.microphone = stream;
                    console.log('✅ Microphone permissions granted with enhanced audio settings');
                } catch (error) {
                    console.error('Microphone permission denied:', error);
                    this.handleMicrophoneError(error);
                    return;
                }
            }
            
            // Small delay to ensure microphone is ready
            setTimeout(() => {
                try {
                    this.recognition.start();
                    console.log('🎤 Speech recognition started successfully');
                } catch (error) {
                    console.error('Failed to start speech recognition:', error);
                    if (error.name === 'InvalidStateError') {
                        this.showError('Speech recognition is already running. Please wait and try again.');
                    } else {
                        this.showError('Failed to start speech recognition: ' + error.message);
                    }
                    this.isTalking = false;
                    this.updateTalkButtonState('error');
                }
            }, 100);
            
        } catch (error) {
            console.error('Failed to start talking:', error);
            this.showError('Failed to start speech recognition. Please try again.');
            this.isTalking = false;
            this.updateTalkButtonState('error');
        }
    }

    handleMicrophoneError(error) {
        this.isTalking = false;
        this.updateTalkButtonState('error');
        
        switch(error.name) {
            case 'NotAllowedError':
                this.showError('❌ Microphone access denied. Please:\n1. Click the microphone icon in your browser address bar\n2. Select "Always allow" for microphone access\n3. Reload the page and try again');
                break;
            case 'NotFoundError':
                this.showError('❌ No microphone found. Please:\n1. Connect a microphone or headset\n2. Check your system audio settings\n3. Reload the page and try again');
                break;
            case 'NotReadableError':
                this.showError('❌ Microphone is busy. Please:\n1. Close other applications using the microphone\n2. Disconnect and reconnect your headset\n3. Try again');
                break;
            default:
                this.showError(`❌ Microphone error: ${error.message}. Please check your microphone settings and try again.`);
        }
    }

    stopTalking() {
        if (!this.isTalking && !this.isListening) return;
        
        console.log('🛑 Stopping speech recognition');
        
        this.isTalking = false;
        
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping speech recognition:', error);
            }
        }
        
        this.updateTalkButtonState('ready');
    }

    handleSpeechResult(transcript) {
        if (!transcript || transcript.trim().length === 0) {
            this.showError('No speech detected. Please try again.');
            this.updateTalkButtonState('ready');
            return;
        }
        
        console.log('📝 Processing speech result:', transcript);
        this.updateTalkButtonState('processing');
        
        // Send text for translation via WebSocket
        if (this.socket && this.roomId) {
            this.socket.emit('text-translation', {
                text: transcript.trim(),
                roomId: this.roomId,
                timestamp: Date.now()
            });
            
            // Reset button state after sending
            setTimeout(() => {
                this.updateTalkButtonState('ready');
            }, 1000);
        } else {
            this.showError('Not connected to translation service.');
            this.updateTalkButtonState('error');
        }
    }

    async processRecordedAudio() {
        if (this.audioChunks.length === 0) return;
        
        try {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
            const audioBuffer = await audioBlob.arrayBuffer();
            const audioData = Array.from(new Uint8Array(audioBuffer));
            
            // Send to server for processing
            if (this.socket && this.roomId) {
                this.socket.emit('audio-stream', {
                    audioData: audioData,
                    roomId: this.roomId,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('Failed to process audio:', error);
            this.showError('Failed to process audio. Please try again.');
        }
    }

    handleIncomingTranslation(data) {
        console.log('Received translation:', data);
        
        // Add to conversation log
        this.addToConversation({
            type: 'incoming',
            originalText: data.originalText,
            translatedText: data.translatedText,
            fromLanguage: data.fromLanguage,
            timestamp: data.timestamp
        });
        
        // Play audio if auto-play is enabled
        if (this.autoPlay && data.audioBase64) {
            this.playAudioFromBase64(data.audioBase64);
        }
    }

    handleIncomingTextTranslation(data) {
        console.log('Received text translation:', data);
        
        // Add to conversation log
        this.addToConversation({
            type: 'incoming',
            originalText: data.originalText,
            translatedText: data.translatedText,
            fromLanguage: data.fromLanguage,
            timestamp: data.timestamp
        });
        
        // Use Web Speech API for text-to-speech
        if (this.autoPlay && data.translatedText) {
            this.speakText(data.translatedText, this.userLanguage);
        }
    }

    handleTextEcho(data) {
        console.log('Text echo received:', data);
        
        // Add to conversation log as outgoing
        this.addToConversation({
            type: 'outgoing',
            originalText: data.originalText,
            timestamp: data.timestamp
        });
    }

    speakText(text, language) {
        if (!this.speechSynthesis || !text) return;
        
        try {
            // Cancel any ongoing speech
            this.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = language === 'en' ? 'en-US' : 'de-DE';
            utterance.rate = 0.9;
            utterance.volume = this.volume;
            
            // Try to find a voice for the language
            const voices = this.speechSynthesis.getVoices();
            const voice = voices.find(v => v.lang.startsWith(language === 'en' ? 'en' : 'de'));
            if (voice) {
                utterance.voice = voice;
            }
            
            this.speechSynthesis.speak(utterance);
            console.log(`🔊 Speaking: "${text}" in ${language}`);
            
        } catch (error) {
            console.error('Text-to-speech error:', error);
        }
    }

    handleAudioEcho(data) {
        console.log('Audio echo received:', data);
        
        // Add to conversation log as outgoing
        this.addToConversation({
            type: 'outgoing',
            originalText: data.originalText,
            timestamp: data.timestamp
        });
    }

    handlePeerVoiceActivity(data) {
        const peerVoiceActivity = document.getElementById('peerVoiceActivity');
        const activityText = peerVoiceActivity.querySelector('.activity-text');
        
        if (data.isActive) {
            peerVoiceActivity.querySelector('.voice-indicator').classList.add('active');
            activityText.textContent = 'Speaking...';
        } else {
            peerVoiceActivity.querySelector('.voice-indicator').classList.remove('active');
            activityText.textContent = 'Listening...';
        }
    }

    handlePeerHeadsetStatus(data) {
        // Update peer headset status display if needed
        console.log('Peer headset status:', data);
    }

    addToConversation(message) {
        const conversationLog = document.getElementById('conversationLog');
        const messageElement = document.createElement('div');
        messageElement.className = `conversation-item ${message.type}`;
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div class="message-content">
                ${message.originalText ? `<div class="original-text">${message.originalText}</div>` : ''}
                ${message.translatedText ? `<div class="translated-text">${message.translatedText}</div>` : ''}
                <div class="message-meta">
                    <span class="timestamp">${timestamp}</span>
                    ${message.fromLanguage ? `<span class="language">${message.fromLanguage === 'en' ? 'English' : 'German'}</span>` : ''}
                </div>
            </div>
        `;
        
        conversationLog.appendChild(messageElement);
        conversationLog.scrollTop = conversationLog.scrollHeight;
        
        this.conversationHistory.push(message);
    }

    async playAudioFromBase64(audioBase64) {
        try {
            const audioData = atob(audioBase64);
            const audioBuffer = new ArrayBuffer(audioData.length);
            const audioArray = new Uint8Array(audioBuffer);
            
            for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
            }
            
            const blob = new Blob([audioBuffer], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            
            audio.volume = this.volume;
            await audio.play();
            
            // Clean up
            audio.addEventListener('ended', () => {
                URL.revokeObjectURL(audioUrl);
            });
            
        } catch (error) {
            console.error('Failed to play audio:', error);
        }
    }

    updateVoiceIndicator(isActive) {
        const voiceIndicator = document.getElementById('voiceIndicator');
        if (isActive && !this.isTalking) {
            voiceIndicator.classList.add('active');
        } else if (!this.isTalking) {
            voiceIndicator.classList.remove('active');
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const muteBtn = document.getElementById('muteBtn');
        const icon = muteBtn.querySelector('.icon');
        const text = muteBtn.querySelector('.text');
        
        if (this.isMuted) {
            icon.textContent = '🔇';
            text.textContent = 'Unmute';
            
            // Mute microphone
            if (this.microphone) {
                this.microphone.getAudioTracks().forEach(track => {
                    track.enabled = false;
                });
            }
        } else {
            icon.textContent = '🔊';
            text.textContent = 'Mute';
            
            // Unmute microphone
            if (this.microphone) {
                this.microphone.getAudioTracks().forEach(track => {
                    track.enabled = true;
                });
            }
        }
    }

    openSettings() {
        document.getElementById('settingsModal').classList.add('show');
    }

    closeSettings() {
        document.getElementById('settingsModal').classList.remove('show');
    }

    updateVolume(value) {
        this.volume = value / 100;
        document.getElementById('volumeValue').textContent = `${value}%`;
    }

    copyRoomCode() {
        const roomCode = this.roomId;
        navigator.clipboard.writeText(roomCode).then(() => {
            this.showSuccess('Room code copied to clipboard!');
        }).catch(() => {
            this.showError('Failed to copy room code.');
        });
    }

    async pasteRoomCode() {
        try {
            const text = await navigator.clipboard.readText();
            const roomCode = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            
            if (roomCode.length === 0) {
                this.showError('No valid room code found in clipboard.');
                return;
            }
            
            // Take first 6 characters if longer
            const finalCode = roomCode.slice(0, 6);
            
            const input = document.getElementById('roomCodeInput');
            input.value = finalCode;
            input.focus();
            
            // Only select if it's a complete code
            if (finalCode.length === 6) {
                setTimeout(() => input.select(), 10);
                this.showSuccess(`Room code pasted: ${finalCode}`);
            } else {
                // Place cursor at the end for partial codes
                input.setSelectionRange(finalCode.length, finalCode.length);
                this.showSuccess(`Partial room code pasted: ${finalCode} (${6 - finalCode.length} more characters needed)`);
            }
            
        } catch (error) {
            console.error('Failed to read from clipboard:', error);
            
            // Fallback: focus the input and show helpful message
            const input = document.getElementById('roomCodeInput');
            input.focus();
            
            this.showError('Clipboard access denied. Please manually paste (Ctrl+V or Cmd+V) into the input field.');
        }
    }

    shareRoomCode() {
        const roomCode = this.roomId;
        const shareData = {
            title: 'Real-Time Translator Room',
            text: `Join my translation room with code: ${roomCode}`,
            url: window.location.href
        };

        // Check if Web Share API is supported
        if (navigator.share) {
            navigator.share(shareData).then(() => {
                console.log('Room code shared successfully');
            }).catch((error) => {
                console.error('Error sharing room code:', error);
                // Fallback to copy
                this.copyRoomCode();
            });
        } else {
            // Fallback: copy to clipboard and show instructions
            navigator.clipboard.writeText(`Join my translation room with code: ${roomCode}\n${window.location.href}`).then(() => {
                this.showSuccess('Room details copied to clipboard! Share this with the other user.');
            }).catch(() => {
                this.showError('Sharing not supported. Please manually share the room code: ' + roomCode);
            });
        }
    }

    clearConversation() {
        document.getElementById('conversationLog').innerHTML = `
            <div class="conversation-item welcome">
                <div class="message-content">
                    <p>Conversation cleared. Continue speaking for real-time translation.</p>
                </div>
            </div>
        `;
        this.conversationHistory = [];
    }

    leaveSession() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        // Reset state
        this.isConnected = false;
        this.peerConnected = false;
        this.isTalking = false;
        this.roomId = null;
        
        // Switch back to setup view
        document.getElementById('communicationSection').style.display = 'none';
        document.getElementById('setupSection').style.display = 'block';
        
        this.updateConnectionStatus('disconnected');
        this.showSuccess('Left translation session.');
    }

    updateConnectionStatus(status) {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (status === 'connected') {
            statusIndicator.classList.remove('disconnected');
            statusText.textContent = 'Connected';
        } else {
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Disconnected';
        }
    }

    updateUI() {
        this.updateLanguageDisplay();
        document.getElementById('volumeSlider').value = this.volume * 100;
        document.getElementById('volumeValue').textContent = `${Math.round(this.volume * 100)}%`;
        document.getElementById('autoPlayToggle').checked = this.autoPlay;
    }

    showError(message) {
        const errorToast = document.getElementById('errorToast');
        const errorMessage = document.getElementById('errorMessage');
        
        errorMessage.textContent = message;
        errorToast.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideToast('errorToast');
        }, 5000);
    }

    showSuccess(message) {
        const successToast = document.getElementById('successToast');
        const successMessage = document.getElementById('successMessage');
        
        successMessage.textContent = message;
        successToast.classList.add('show');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.hideToast('successToast');
        }, 3000);
    }

    showInfo(message) {
        // Use success toast for info messages with blue styling
        const successToast = document.getElementById('successToast');
        const successMessage = document.getElementById('successMessage');
        
        successMessage.textContent = message;
        successToast.style.background = '#007bff';
        successToast.classList.add('show');
        
        // Auto-hide after 4 seconds and reset background
        setTimeout(() => {
            this.hideToast('successToast');
            successToast.style.background = '';
        }, 4000);
    }

    showWarning(message) {
        const successToast = document.getElementById('successToast');
        const successMessage = document.getElementById('successMessage');
        
        successMessage.textContent = message;
        successToast.style.background = '#f59e0b';
        successToast.style.color = '#92400e';
        successToast.classList.add('show');
        
        // Auto-hide after 4 seconds and reset styling
        setTimeout(() => {
            this.hideToast('successToast');
            successToast.style.background = '';
            successToast.style.color = '';
        }, 4000);
    }

    hideToast(toastId) {
        document.getElementById(toastId).classList.remove('show');
    }

    setupRoomCodeValidation() {
        const roomCodeInput = document.getElementById('roomCodeInput');
        
        // Add validation indicator to the room input
        const indicator = document.createElement('span');
        indicator.className = 'room-code-indicator';
        indicator.id = 'roomCodeIndicator';
        roomCodeInput.parentElement.style.position = 'relative';
        roomCodeInput.parentElement.appendChild(indicator);
        
        // Add status message container
        const statusMessage = document.createElement('div');
        statusMessage.className = 'room-status-message';
        statusMessage.id = 'roomStatusMessage';
        roomCodeInput.parentElement.appendChild(statusMessage);
        
        // Real-time validation
        roomCodeInput.addEventListener('input', (e) => {
            this.validateRoomCode(e.target.value);
        });
        
        // Validate on blur
        roomCodeInput.addEventListener('blur', (e) => {
            this.validateRoomCode(e.target.value, true);
        });
    }

    validateRoomCode(value, showDetailedMessages = false) {
        const roomCodeInput = document.getElementById('roomCodeInput');
        const indicator = document.getElementById('roomCodeIndicator');
        const statusMessage = document.getElementById('roomStatusMessage');
        
        // Clean the value
        const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Reset classes
        roomCodeInput.classList.remove('error', 'success');
        indicator.classList.remove('show', 'valid', 'invalid');
        statusMessage.classList.remove('show', 'success', 'error', 'info');
        
        if (cleanValue.length === 0) {
            this.showRoomStatus('Enter a 6-digit room code or generate a new one', 'info');
            return false;
        }
        
        if (cleanValue.length < 6) {
            if (showDetailedMessages) {
                roomCodeInput.classList.add('error');
                indicator.textContent = '❌';
                indicator.classList.add('show', 'invalid');
                this.showRoomStatus(`Room code must be exactly 6 characters (currently ${cleanValue.length})`, 'error');
            }
            return false;
        }
        
        if (cleanValue.length === 6) {
            roomCodeInput.classList.add('success');
            indicator.textContent = '✓';
            indicator.classList.add('show', 'valid');
            
            if (showDetailedMessages) {
                this.showRoomStatus('✓ Valid room code format! Ready to join.', 'success');
            }
            return true;
        }
        
        return false;
    }

    showRoomStatus(message, type = 'info') {
        const statusMessage = document.getElementById('roomStatusMessage');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.classList.remove('show', 'success', 'error', 'info');
            statusMessage.classList.add('show', type);
            
            // Auto-hide info messages after 3 seconds
            if (type === 'info') {
                setTimeout(() => {
                    statusMessage.classList.remove('show');
                }, 3000);
            }
        }
    }

    addConnectionVisualization() {
        const roomSection = document.querySelector('.room-section');
        
        // Create connection visualization
        const visualContainer = document.createElement('div');
        visualContainer.className = 'users-connection-visual';
        visualContainer.id = 'connectionVisual';
        visualContainer.innerHTML = `
            <div class="user-avatar-visual">
                <div class="avatar-circle current-user" id="currentUserAvatar">
                    <span id="currentUserFlag">🇺🇸</span>
                </div>
                <div class="user-label">You</div>
            </div>
            
            <div class="connection-line" id="connectionLine"></div>
            
            <div class="user-avatar-visual">
                <div class="avatar-circle" id="otherUserAvatar">
                    <span id="otherUserFlag">❓</span>
                </div>
                <div class="user-label" id="otherUserLabel">Waiting...</div>
            </div>
        `;
        
        // Insert before room help section
        const roomHelp = roomSection.querySelector('.room-help');
        roomSection.insertBefore(visualContainer, roomHelp);
        
        this.updateConnectionVisualization();
    }

    updateConnectionVisualization() {
        const currentUserFlag = document.getElementById('currentUserFlag');
        const otherUserFlag = document.getElementById('otherUserFlag');
        const otherUserLabel = document.getElementById('otherUserLabel');
        const otherUserAvatar = document.getElementById('otherUserAvatar');
        const connectionLine = document.getElementById('connectionLine');
        
        if (currentUserFlag) {
            currentUserFlag.textContent = this.userLanguage === 'en' ? '🇺🇸' : '🇩🇪';
        }
        
        if (this.peerConnected) {
            const peerLanguage = this.userLanguage === 'en' ? 'de' : 'en';
            const peerFlag = peerLanguage === 'en' ? '🇺🇸' : '🇩🇪';
            const peerLabel = peerLanguage === 'en' ? 'English User' : 'German User';
            
            if (otherUserFlag) otherUserFlag.textContent = peerFlag;
            if (otherUserLabel) otherUserLabel.textContent = peerLabel;
            if (otherUserAvatar) otherUserAvatar.classList.add('connected');
            if (connectionLine) connectionLine.classList.add('active');
        } else {
            const expectedPeerLanguage = this.userLanguage === 'en' ? 'German' : 'English';
            if (otherUserFlag) otherUserFlag.textContent = '❓';
            if (otherUserLabel) otherUserLabel.textContent = `Waiting for ${expectedPeerLanguage} user...`;
            if (otherUserAvatar) otherUserAvatar.classList.remove('connected');
            if (connectionLine) connectionLine.classList.remove('active');
        }
    }

    enhanceStartSessionButton() {
        const startBtn = document.getElementById('startSessionBtn');
        
        // Add dynamic button text based on validation
        const updateButtonState = () => {
            const roomCode = document.getElementById('roomCodeInput').value.trim();
            const isValidRoom = this.validateRoomCode(roomCode);
            const hasLanguage = document.querySelector('input[name="userLanguage"]:checked');
            const hasDevice = document.querySelector('input[name="deviceType"]:checked');
            
            if (!hasLanguage) {
                startBtn.textContent = 'Please Select Language';
                startBtn.disabled = true;
                return;
            }
            
            if (!hasDevice) {
                startBtn.textContent = 'Please Select Device Type';
                startBtn.disabled = true;
                return;
            }
            
            if (!isValidRoom) {
                startBtn.textContent = 'Enter Valid Room Code';
                startBtn.disabled = true;
                return;
            }
            
            const language = document.querySelector('input[name="userLanguage"]:checked').value;
            const languageName = language === 'en' ? 'English' : 'German';
            startBtn.textContent = `Join as ${languageName} Speaker`;
            startBtn.disabled = false;
        };
        
        // Update button state on changes
        document.getElementById('roomCodeInput').addEventListener('input', updateButtonState);
        document.querySelectorAll('input[name="userLanguage"]').forEach(radio => {
            radio.addEventListener('change', updateButtonState);
        });
        document.querySelectorAll('input[name="deviceType"]').forEach(radio => {
            radio.addEventListener('change', updateButtonState);
        });
        
        // Initial update
        updateButtonState();
    }

    // ...existing code...
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DualHeadsetTranslator();
});

// Service Worker registration for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
