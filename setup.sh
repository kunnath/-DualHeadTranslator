#!/bin/bash

# Setup script for Dual Headset Real-Time Translator
echo "🎧 Setting up Dual Headset Real-Time Translator..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create .env file from example if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${BLUE}📝 Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created successfully.${NC}"
    echo -e "${YELLOW}💡 Edit .env file to add your OpenAI API key for better translation quality.${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists. Skipping creation.${NC}"
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies installed successfully.${NC}"

# Display setup instructions
echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "   1. Install Ollama: ${YELLOW}brew install ollama${NC} (or visit ollama.ai)"
echo -e "   2. Run: ${YELLOW}./launch-dual-headset.sh${NC}"
echo -e "   3. Open the dual headset interface in two browsers/devices"
echo ""
echo -e "${YELLOW}💡 Ollama with DeepSeek-R1:8B provides high-quality local translation.${NC}"
echo -e "${YELLOW}   No API keys required - everything runs locally!${NC}"
echo ""
echo -e "${BLUE}🔗 Ollama installation: https://ollama.ai${NC}"
