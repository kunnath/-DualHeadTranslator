#!/bin/bash

# Streamlit Voice Translator Launch Script
# This script launches the Streamlit voice translation application

echo "🗣️ Starting Streamlit Voice Translator..."

# Navigate to the project directory
cd "$(dirname "$0")"

# Activate the virtual environment
if [ -d ".venv" ]; then
    echo "📁 Activating virtual environment..."
    source .venv/bin/activate
else
    echo "⚠️ Virtual environment not found, using system Python"
fi

# Upgrade pip first
echo "🔧 Upgrading pip..."
pip install --upgrade pip

# Install clean requirements
echo "📦 Installing core dependencies..."
pip install -r requirements_clean.txt

# Check if Streamlit is available
if ! command -v streamlit &> /dev/null; then
    echo "❌ Streamlit not found. Installing directly..."
    pip install streamlit
fi

# Optional: Try to install audio dependencies
echo "🎵 Attempting to install audio dependencies (may fail on some systems)..."
pip install pyaudio || echo "⚠️ PyAudio installation failed - voice recording may not work"

# Launch the application
echo "🚀 Launching application..."
echo "📱 The app will open in your browser at: http://localhost:8501"
echo "⏹️ Press Ctrl+C to stop the application"
echo ""

# Run the Streamlit app
streamlit run streamlit_app_simple.py --server.address 0.0.0.0 --server.port 8501

echo ""
echo "👋 Thanks for using Voice Translator!"
