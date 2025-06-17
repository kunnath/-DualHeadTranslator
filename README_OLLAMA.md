# Dual Headset Real-Time Translator with Ollama

A real-time voice translation system designed for dual wireless headset communication using **Ollama** with **DeepSeek-R1:8B** for local AI translation.

## ✨ Features

- 🎧 **Dual Headset Support**: Connect two wireless headsets for bidirectional communication
- 🤖 **Local AI Translation**: Uses Ollama with DeepSeek-R1:8B model for high-quality translation
- 🌐 **English ↔ German**: Real-time translation between English and German
- 🎤 **Web Speech API**: Client-side speech recognition and synthesis
- 🔄 **Real-time Communication**: Low latency voice translation
- 📱 **Cross-platform**: Works on desktop and mobile browsers
- 🔒 **Privacy-focused**: All AI processing happens locally

## 🚀 Quick Start

### 1. Install Dependencies

#### Install Ollama
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: Download from https://ollama.ai
```

#### Install Node.js Dependencies
```bash
./setup.sh
```

### 2. Launch the Application
```bash
./launch-dual-headset.sh
```

The script will:
- ✅ Check for Ollama installation
- 🚀 Start Ollama server if not running
- 📥 Download DeepSeek-R1:8B model if needed
- 🌐 Start the translation server

### 3. Connect Your Devices

1. **Device 1 (English Speaker)**: Open `http://localhost:3000/dual-headset`
2. **Device 2 (German Speaker)**: Open `http://localhost:3000/dual-headset`

### 4. Setup Communication

1. Select your language (English or German)
2. Choose "Wireless Headset" as device type
3. One user generates a room code and shares it
4. Both users join the same room
5. Hold the talk button to speak and get real-time translation

## 🎯 How It Works

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   English       │    │              │    │   German        │
│   Headset       │    │   Server     │    │   Headset       │
│                 │    │   (Ollama)   │    │                 │
│ 1. Speech ──────┼───►│              │◄───┼────── Speech   │
│ 2. ◄──── Audio  │    │ DeepSeek-R1  │    │ Audio ────► 2. │
│                 │    │ Translation  │    │                 │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

1. **Speech Recognition**: Web Speech API converts speech to text on client-side
2. **Translation**: Ollama with DeepSeek-R1:8B translates text on server
3. **Speech Synthesis**: Web Speech API converts translated text to speech

## ⚙️ Configuration

### Environment Variables
```bash
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:8b

# Server Configuration
PORT=3000
NODE_ENV=production
```

### Model Management
```bash
# List available models
ollama list

# Pull specific model version
ollama pull deepseek-r1:8b

# Remove model
ollama rm deepseek-r1:8b
```

## 🔧 Troubleshooting

### Ollama Issues
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama manually
ollama serve

# Check Ollama logs
ollama logs
```

### Browser Compatibility
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari: Full support
- ⚠️ Mobile browsers: May have limited speech API support

### Audio Issues
- Ensure microphone permissions are granted
- Check browser audio settings
- Verify headset connection
- Test with different browsers if issues persist

## 📊 Performance

- **Model Size**: ~4.7GB (DeepSeek-R1:8B)
- **RAM Usage**: ~8GB recommended
- **Translation Speed**: ~1-3 seconds per sentence
- **Latency**: <2 seconds end-to-end

## 🌟 Advantages over OpenAI

- 🔒 **Privacy**: No data sent to external servers
- 💰 **Cost**: No API fees or usage limits
- 🌐 **Offline**: Works without internet connection
- ⚡ **Performance**: Consistent speed regardless of API load
- 🎯 **Customization**: Can fine-tune model for specific use cases

## 📚 API Endpoints

- `GET /dual-headset` - Main application interface
- `POST /api/translate-text` - Text-only translation
- `WebSocket` - Real-time communication events

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test with Ollama and DeepSeek-R1:8B
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review Ollama documentation: https://ollama.ai/docs
3. Open an issue on GitHub
