#!/bin/bash

# Dual Headset Real-Time Translator Launch Script
echo "🎧 Starting Dual Headset Real-Time Translator..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Check for Ollama instead of OpenAI API key
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Ollama is not installed.${NC}"
    echo -e "${BLUE}💡 Please install Ollama first:${NC}"
    echo -e "   • macOS: brew install ollama"
    echo -e "   • Linux: curl -fsSL https://ollama.ai/install.sh | sh"
    echo -e "   • Windows: Download from https://ollama.ai"
    echo ""
    read -p "Continue without Ollama? (translation quality will be limited) (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Setup cancelled. Please install Ollama and try again.${NC}"
        exit 1
    fi
    echo -e "${YELLOW}⚠️  Continuing without Ollama. Using basic translation fallback.${NC}"
else
    echo -e "${GREEN}✅ Ollama is installed.${NC}"
    
    # Check if Ollama server is running
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Ollama server is not running. Starting Ollama...${NC}"
        ollama serve &
        OLLAMA_PID=$!
        echo -e "${BLUE}📡 Ollama server started with PID: $OLLAMA_PID${NC}"
        
        # Wait for server to be ready
        echo -e "${BLUE}⏳ Waiting for Ollama server to be ready...${NC}"
        for i in {1..30}; do
            if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Ollama server is ready!${NC}"
                break
            fi
            sleep 1
            if [ $i -eq 30 ]; then
                echo -e "${RED}❌ Ollama server failed to start properly.${NC}"
                exit 1
            fi
        done
    else
        echo -e "${GREEN}✅ Ollama server is running.${NC}"
    fi
    
    # Check if deepseek-r1:8b model is available
    if ! ollama list | grep -q "deepseek-r1:8b"; then
        echo -e "${YELLOW}📥 DeepSeek-R1:8B model not found. Pulling model...${NC}"
        echo -e "${BLUE}💡 This may take several minutes depending on your internet connection.${NC}"
        
        ollama pull deepseek-r1:8b
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ DeepSeek-R1:8B model downloaded successfully!${NC}"
        else
            echo -e "${RED}❌ Failed to download DeepSeek-R1:8B model.${NC}"
            echo -e "${YELLOW}⚠️  Continuing with basic translation fallback.${NC}"
        fi
    else
        echo -e "${GREEN}✅ DeepSeek-R1:8B model is available.${NC}"
    fi
fi

echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies installed successfully.${NC}"

# Set environment variables for optimal performance
export NODE_ENV=production
export PORT=3000
export OLLAMA_HOST=http://localhost:11434
export OLLAMA_MODEL=deepseek-r1:8b

echo -e "${YELLOW}⚙️  Configuration:${NC}"
echo -e "   • Server Port: ${PORT}"
echo -e "   • Environment: ${NODE_ENV}"
echo -e "   • Ollama Host: ${OLLAMA_HOST}"
echo -e "   • AI Model: ${OLLAMA_MODEL}"
echo -e "   • Dual Headset Interface: http://localhost:${PORT}/dual-headset"

echo -e "${BLUE}🚀 Starting the server...${NC}"
echo -e "${YELLOW}📱 Open these URLs in separate devices:${NC}"
echo -e "   • Device 1 (English): http://localhost:${PORT}/dual-headset"
echo -e "   • Device 2 (German): http://localhost:${PORT}/dual-headset"
echo ""
echo -e "${GREEN}💡 Instructions:${NC}"
echo -e "   1. Both users open the dual-headset interface"
echo -e "   2. Select your language (English or German)"
echo -e "   3. Choose 'Wireless Headset' as device type"
echo -e "   4. One user generates a room code, shares it with the other"
echo -e "   5. Both users join the same room"
echo -e "   6. Hold the talk button to speak and get real-time translation"
echo ""
echo -e "${BLUE}🎯 Features:${NC}"
echo -e "   • Real-time speech-to-speech translation with Ollama AI"
echo -e "   • DeepSeek-R1:8B model for high-quality translations"
echo -e "   • Optimized for wireless headsets"
echo -e "   • Low latency communication"
echo -e "   • Voice activity detection"
echo -e "   • Conversation history"
echo -e "   • Local AI processing (no API keys required)"
echo ""

# Cleanup function for graceful shutdown
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
    if [ ! -z "$OLLAMA_PID" ]; then
        echo -e "${BLUE}📡 Stopping Ollama server...${NC}"
        kill $OLLAMA_PID 2>/dev/null
    fi
    exit 0
}

# Set trap for cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start the server
node server.js
