import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { VoiceTranslator } from './src/services/VoiceTranslator.js';
import { TranslationService } from './src/services/TranslationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize services
const voiceTranslator = new VoiceTranslator();
const translationService = new TranslationService();

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dual-headset', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dual-headset.html'));
});

app.get('/api/room-status/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = activeRooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const users = Array.from(room.users.values()).map(user => ({
    language: user.language,
    deviceType: user.deviceType,
    joinedAt: user.joinedAt,
    isActive: user.isActive
  }));
  
  res.json({
    roomId: roomId,
    userCount: room.users.size,
    users: users,
    createdAt: room.createdAt,
    isActive: room.isActive
  });
});

// New route for text-only translation using Ollama
app.post('/api/translate-text', async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage } = req.body;
    
    if (!text || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({ error: 'Missing required fields: text, sourceLanguage, targetLanguage' });
    }

    console.log(`🔄 Text translation request: "${text}" (${sourceLanguage} -> ${targetLanguage})`);

    // Use VoiceTranslator for text translation
    const result = await voiceTranslator.processTextTranslation(text, sourceLanguage, targetLanguage);

    res.json({
      originalText: result.originalText,
      translatedText: result.translatedText,
      success: true,
      timestamp: result.timestamp
    });

  } catch (error) {
    console.error('Text translation error:', error);
    res.status(500).json({ 
      error: 'Translation failed', 
      details: error.message 
    });
  }
});

app.post('/api/translate-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { sourceLanguage, targetLanguage } = req.body;
    const audioBuffer = req.file.buffer;

    // Convert speech to text
    const transcribedText = await voiceTranslator.speechToText(audioBuffer, sourceLanguage);
    
    // Translate text
    const translatedText = await translationService.translateText(
      transcribedText, 
      sourceLanguage, 
      targetLanguage
    );

    // Convert translated text to speech
    const audioResponse = await voiceTranslator.textToSpeech(translatedText, targetLanguage);

    res.json({
      originalText: transcribedText,
      translatedText: translatedText,
      audioBase64: audioResponse.toString('base64'),
      success: true
    });

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ 
      error: 'Translation failed', 
      details: error.message 
    });
  }
});

// Store active rooms and user sessions
const activeRooms = new Map();
const userSessions = new Map();

// WebSocket for real-time dual headset communication
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', (data) => {
    const { roomId, userLanguage, deviceType } = data;
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, {
        users: new Map(),
        createdAt: new Date(),
        isActive: true
      });
    }
    
    const room = activeRooms.get(roomId);
    
    // Store user session data
    const userSession = {
      socketId: socket.id,
      roomId: roomId,
      language: userLanguage, // 'en' or 'de'
      deviceType: deviceType, // 'headset' or 'mobile'
      joinedAt: new Date(),
      isActive: true
    };
    
    room.users.set(socket.id, userSession);
    userSessions.set(socket.id, userSession);
    
    console.log(`User ${socket.id} (${userLanguage}) joined room ${roomId} with ${deviceType}`);
    
    // Notify room about new user
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      language: userLanguage,
      deviceType: deviceType,
      totalUsers: room.users.size
    });
    
    // Send room status to the joining user
    socket.emit('room-joined', {
      roomId: roomId,
      userLanguage: userLanguage,
      totalUsers: room.users.size,
      otherUsers: Array.from(room.users.values()).filter(u => u.socketId !== socket.id)
    });
  });

  // New handler for text-based translation (client-side STT + Ollama translation)
  socket.on('text-translation', async (data) => {
    try {
      const { text, roomId, timestamp } = data;
      const userSession = userSessions.get(socket.id);
      
      if (!userSession) {
        socket.emit('translation-error', { error: 'User session not found' });
        return;
      }
      
      const sourceLanguage = userSession.language;
      const targetLanguage = sourceLanguage === 'en' ? 'de' : 'en';
      
      console.log(`🔄 Text translation: "${text}" (${sourceLanguage} -> ${targetLanguage})`);
      
      // Process text translation using Ollama
      const result = await voiceTranslator.processTextTranslation(
        text, 
        sourceLanguage, 
        targetLanguage
      );
      
      // Get room and target users
      const room = activeRooms.get(roomId);
      if (!room) {
        socket.emit('translation-error', { error: 'Room not found' });
        return;
      }
      
      // Broadcast translated text to users with target language
      Array.from(room.users.values()).forEach(user => {
        if (user.socketId !== socket.id && user.language === targetLanguage) {
          io.to(user.socketId).emit('translated-text', {
            originalText: result.originalText,
            translatedText: result.translatedText,
            fromUser: socket.id,
            fromLanguage: sourceLanguage,
            timestamp: timestamp || Date.now()
          });
        }
      });
      
      // Echo back original to sender for confirmation
      socket.emit('text-echo', {
        originalText: result.originalText,
        processed: true,
        timestamp: timestamp || Date.now()
      });
      
    } catch (error) {
      console.error('Text translation error:', error);
      socket.emit('translation-error', { error: error.message });
    }
  });

  socket.on('audio-stream', async (data) => {
    try {
      const { audioData, roomId, timestamp } = data;
      const userSession = userSessions.get(socket.id);
      
      if (!userSession) {
        socket.emit('translation-error', { error: 'User session not found' });
        return;
      }
      
      const sourceLanguage = userSession.language;
      const targetLanguage = sourceLanguage === 'en' ? 'de' : 'en';
      
      // Process audio stream in real-time
      const result = await voiceTranslator.processAudioStream(
        audioData, 
        sourceLanguage, 
        targetLanguage
      );
      
      // Get room and target users
      const room = activeRooms.get(roomId);
      if (!room) {
        socket.emit('translation-error', { error: 'Room not found' });
        return;
      }
      
      // Broadcast translated audio to users with target language
      Array.from(room.users.values()).forEach(user => {
        if (user.socketId !== socket.id && user.language === targetLanguage) {
          io.to(user.socketId).emit('translated-audio', {
            originalText: result.originalText,
            translatedText: result.translatedText,
            audioBase64: result.audioBase64,
            fromUser: socket.id,
            fromLanguage: sourceLanguage,
            timestamp: timestamp
          });
        }
      });
      
      // Echo back original to sender for confirmation
      socket.emit('audio-echo', {
        originalText: result.originalText,
        processed: true,
        timestamp: timestamp
      });
      
    } catch (error) {
      console.error('Real-time translation error:', error);
      socket.emit('translation-error', { error: error.message });
    }
  });
  
  socket.on('voice-activity', (data) => {
    const { isActive, roomId } = data;
    const userSession = userSessions.get(socket.id);
    
    if (userSession) {
      // Notify other users about voice activity
      socket.to(roomId).emit('peer-voice-activity', {
        userId: socket.id,
        isActive: isActive,
        language: userSession.language
      });
    }
  });
  
  socket.on('headset-status', (data) => {
    const { isConnected, batteryLevel, roomId } = data;
    const userSession = userSessions.get(socket.id);
    
    if (userSession) {
      userSession.headsetConnected = isConnected;
      userSession.batteryLevel = batteryLevel;
      
      // Notify other users about headset status
      socket.to(roomId).emit('peer-headset-status', {
        userId: socket.id,
        isConnected: isConnected,
        batteryLevel: batteryLevel,
        language: userSession.language
      });
    }
  });
  
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const userSession = userSessions.get(socket.id);
    if (userSession) {
      const { roomId } = userSession;
      const room = activeRooms.get(roomId);
      
      if (room) {
        room.users.delete(socket.id);
        
        // Notify other users about disconnection
        socket.to(roomId).emit('user-left', {
          userId: socket.id,
          language: userSession.language,
          totalUsers: room.users.size
        });
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          activeRooms.delete(roomId);
          console.log(`Room ${roomId} deleted - no active users`);
        }
      }
      
      userSessions.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Voice Translator Server running on port ${PORT}`);
  console.log(`📱 Web interface: http://localhost:${PORT}`);
});
