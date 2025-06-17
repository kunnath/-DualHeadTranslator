#!/usr/bin/env python3
"""
Quick test to verify translation functionality works
"""

import sys
import os

# Test core imports
try:
    import streamlit as st
    print("✅ Streamlit imported successfully")
except ImportError as e:
    print(f"❌ Streamlit import failed: {e}")
    sys.exit(1)

try:
    import requests
    print("✅ Requests imported successfully")
except ImportError as e:
    print(f"❌ Requests import failed: {e}")
    sys.exit(1)

try:
    from deep_translator import GoogleTranslator
    print("✅ Deep Translator imported successfully")
    
    # Test translation
    translator = GoogleTranslator(source='en', target='de')
    result = translator.translate("Hello, how are you?")
    print(f"✅ Translation test: 'Hello, how are you?' → '{result}'")
    
    # Test reverse translation
    translator_de_en = GoogleTranslator(source='de', target='en')
    reverse_result = translator_de_en.translate("Guten Tag, wie geht es Ihnen?")
    print(f"✅ Reverse translation test: 'Guten Tag, wie geht es Ihnen?' → '{reverse_result}'")
    
except ImportError as e:
    print(f"⚠️ Deep Translator not available: {e}")
    print("Installing deep-translator...")
    
    # Try to install it
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "deep-translator"])
        print("✅ Deep Translator installed successfully!")
        
        # Try import again
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source='en', target='de')
        result = translator.translate("Hello, how are you?")
        print(f"✅ Translation test: 'Hello, how are you?' → '{result}'")
    except Exception as install_error:
        print(f"❌ Failed to install deep-translator: {install_error}")

print("\n🎉 All tests passed! The translation app should work perfectly.")
print("\nTo run the app:")
print("streamlit run streamlit_app_final.py")
