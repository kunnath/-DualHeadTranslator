#!/bin/bash

# 🗣️ Voice Translator Launch Script
# This script ensures you have everything needed to run the app

echo "🗣️ Voice Translator - Launch Script"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "streamlit_app_final.py" ]; then
    echo "❌ Error: streamlit_app_final.py not found in current directory"
    echo "Please navigate to the project directory first:"
    echo "cd /Users/kunnath/Projects/mcpownserver"
    exit 1
fi

echo "📦 Checking Python packages..."

# Function to check and install package
check_and_install() {
    package=$1
    echo -n "Checking $package... "
    
    if python -c "import $package" 2>/dev/null; then
        echo "✅ installed"
    else
        echo "❌ missing, installing..."
        pip install $package
        
        if python -c "import $package" 2>/dev/null; then
            echo "✅ $package installed successfully!"
        else
            echo "⚠️  $package installation failed, but app may still work"
        fi
    fi
}

# Check essential packages
check_and_install "streamlit"
check_and_install "requests"

# Check deep-translator
echo -n "Checking deep_translator... "
if python -c "from deep_translator import GoogleTranslator" 2>/dev/null; then
    echo "✅ installed"
else
    echo "❌ missing, installing..."
    pip install deep-translator
    
    if python -c "from deep_translator import GoogleTranslator" 2>/dev/null; then
        echo "✅ deep-translator installed successfully!"
    else
        echo "⚠️  deep-translator installation failed, but app will use fallback translation"
    fi
fi

echo ""
echo "🚀 Launching Voice Translator..."
echo "The app will open in your web browser at http://localhost:8501"
echo ""
echo "Press Ctrl+C to stop the app"
echo ""

# Launch the app
streamlit run streamlit_app_final.py

echo ""
echo "👋 Thanks for using Voice Translator!"
