#!/usr/bin/env python3
"""
Real-Time Voice Translator - Streamlit Application
A modern voice translation app enabling seamless English ⇄ German communication

Setup Instructions:
1. Install Python 3.8+
2. Run: pip install -r requirements.txt
3. Run: streamlit run streamlit_app_simple.py
"""

import sys
import os
from pathlib import Path

# Check for required imports and provide helpful error messages
try:
    import streamlit as st
except ImportError:
    print("❌ Streamlit not found. Please install with: pip install streamlit")
    sys.exit(1)

# Set page config first
st.set_page_config(
    page_title="🗣️ Voice Translator | English ⇄ German",
    page_icon="🗣️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Try to import required libraries
missing_libs = []
optional_libs = []

try:
    import speech_recognition as sr
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    missing_libs.append("SpeechRecognition")
    SPEECH_RECOGNITION_AVAILABLE = False

try:
    import pyttsx3
    TTS_AVAILABLE = True
except ImportError:
    optional_libs.append("pyttsx3")
    TTS_AVAILABLE = False

try:
    from googletrans import Translator
    TRANSLATION_AVAILABLE = True
except ImportError:
    missing_libs.append("googletrans")
    TRANSLATION_AVAILABLE = False

try:
    import numpy as np
    import sounddevice as sd
    AUDIO_PROCESSING_AVAILABLE = True
except ImportError:
    optional_libs.append("numpy, sounddevice")
    AUDIO_PROCESSING_AVAILABLE = False

# Standard library imports
import tempfile
import threading
import time
import base64
import json
from datetime import datetime
import queue
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VoiceTranslatorApp:
    """Streamlit Voice Translation Application"""
    
    def __init__(self):
        self.setup_session_state()
        self.setup_styles()
        self.initialize_services()
        
    def setup_session_state(self):
        """Initialize Streamlit session state"""
        if 'conversation_history' not in st.session_state:
            st.session_state.conversation_history = []
            
        if 'source_language' not in st.session_state:
            st.session_state.source_language = 'en'
            
        if 'target_language' not in st.session_state:
            st.session_state.target_language = 'de'
            
        if 'current_translation' not in st.session_state:
            st.session_state.current_translation = None
            
        if 'session_stats' not in st.session_state:
            st.session_state.session_stats = {
                'translations_count': 0,
                'session_start': datetime.now(),
                'total_words': 0
            }
    
    def setup_styles(self):
        """Setup custom CSS styles"""
        st.markdown("""
        <style>
        .main-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 2rem;
            border-radius: 15px;
            color: white;
            text-align: center;
            margin-bottom: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .language-selector {
            background: linear-gradient(135deg, #f8fafc, #e2e8f0);
            padding: 1.5rem;
            border-radius: 15px;
            border: 2px solid #e2e8f0;
            margin: 1rem 0;
            text-align: center;
        }
        
        .translation-box {
            background: white;
            padding: 1.5rem;
            border-radius: 15px;
            border-left: 4px solid #667eea;
            margin: 1rem 0;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .success-box {
            background: linear-gradient(135deg, #48bb78, #38a169);
            color: white;
            padding: 1rem;
            border-radius: 10px;
            margin: 1rem 0;
        }
        
        .warning-box {
            background: linear-gradient(135deg, #ed8936, #dd6b20);
            color: white;
            padding: 1rem;
            border-radius: 10px;
            margin: 1rem 0;
        }
        
        .error-box {
            background: linear-gradient(135deg, #f56565, #e53e3e);
            color: white;
            padding: 1rem;
            border-radius: 10px;
            margin: 1rem 0;
        }
        
        .feature-card {
            background: #f8fafc;
            padding: 1.5rem;
            border-radius: 10px;
            border: 2px solid #e2e8f0;
            margin: 1rem 0;
            text-align: center;
        }
        
        .feature-card:hover {
            border-color: #667eea;
            transform: translateY(-2px);
            transition: all 0.3s ease;
        }
        
        .history-item {
            background: #f8fafc;
            padding: 1rem;
            border-radius: 10px;
            margin: 0.5rem 0;
            border-left: 3px solid #48bb78;
        }
        
        .metric-card {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 1rem;
            border-radius: 10px;
            text-align: center;
        }
        
        .installation-box {
            background: #2d3748;
            color: #e2e8f0;
            padding: 1rem;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            margin: 1rem 0;
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            color: #718096;
            margin-top: 3rem;
            border-top: 1px solid #e2e8f0;
        }
        </style>
        """, unsafe_allow_html=True)
    
    def initialize_services(self):
        """Initialize available services"""
        self.services_status = {
            'speech_recognition': SPEECH_RECOGNITION_AVAILABLE,
            'translation': TRANSLATION_AVAILABLE,
            'tts': TTS_AVAILABLE,
            'audio_processing': AUDIO_PROCESSING_AVAILABLE
        }
        
        if SPEECH_RECOGNITION_AVAILABLE:
            try:
                self.recognizer = sr.Recognizer()
                self.microphone = sr.Microphone()
            except Exception as e:
                logger.error(f"Speech recognition setup error: {e}")
                self.services_status['speech_recognition'] = False
        
        if TTS_AVAILABLE:
            try:
                self.tts_engine = pyttsx3.init()
                self.tts_engine.setProperty('rate', 150)
                self.tts_engine.setProperty('volume', 0.9)
            except Exception as e:
                logger.error(f"TTS setup error: {e}")
                self.services_status['tts'] = False
        
        if TRANSLATION_AVAILABLE:
            try:
                self.translator = Translator()
            except Exception as e:
                logger.error(f"Translation setup error: {e}")
                self.services_status['translation'] = False
    
    def render_header(self):
        """Render application header"""
        st.markdown("""
        <div class="main-header">
            <h1>🗣️ Real-Time Voice Translator</h1>
            <h3>English ⇄ German • Seamless Communication</h3>
            <p>Speak naturally, understand instantly</p>
        </div>
        """, unsafe_allow_html=True)
    
    def check_dependencies(self):
        """Check and display dependency status"""
        if missing_libs or not all(self.services_status.values()):
            st.warning("⚠️ Some dependencies are missing or not working properly")
            
            with st.expander("🔧 Installation Guide", expanded=True):
                st.markdown("### Required Dependencies")
                
                if missing_libs:
                    st.error(f"❌ Missing critical libraries: {', '.join(missing_libs)}")
                    
                    st.markdown("### Install Missing Dependencies:")
                    st.code("""
# Install all requirements
pip install -r requirements.txt

# Or install individually:
pip install streamlit
pip install SpeechRecognition
pip install googletrans==4.0.0rc1
pip install pyttsx3
pip install numpy sounddevice scipy
                    """, language="bash")
                
                if optional_libs:
                    st.warning(f"⚠️ Optional libraries not available: {', '.join(optional_libs)}")
                
                st.markdown("### Additional Setup for Audio:")
                st.code("""
# On macOS:
brew install portaudio
pip install pyaudio

# On Ubuntu/Debian:
sudo apt-get install portaudio19-dev python3-pyaudio
pip install pyaudio

# On Windows:
pip install pyaudio
                    """, language="bash")
                
                st.info("💡 After installing dependencies, restart the application")
                
                return False
        
        return True
    
    def render_sidebar(self):
        """Render sidebar controls"""
        with st.sidebar:
            st.title("🎛️ Controls")
            
            # Service Status
            st.subheader("🔧 Service Status")
            
            services = [
                ("Speech Recognition", self.services_status['speech_recognition']),
                ("Translation", self.services_status['translation']),
                ("Text-to-Speech", self.services_status['tts']),
                ("Audio Processing", self.services_status['audio_processing'])
            ]
            
            for service_name, status in services:
                status_icon = "✅" if status else "❌"
                st.write(f"{status_icon} {service_name}")
            
            st.divider()
            
            # Language Selection
            st.subheader("🌍 Language Settings")
            
            col1, col2 = st.columns(2)
            
            with col1:
                if st.button("🇺🇸 EN → DE", use_container_width=True):
                    st.session_state.source_language = 'en'
                    st.session_state.target_language = 'de'
                    
            with col2:
                if st.button("🇩🇪 DE → EN", use_container_width=True):
                    st.session_state.source_language = 'de'
                    st.session_state.target_language = 'en'
            
            # Show current settings
            source_lang = "English 🇺🇸" if st.session_state.source_language == 'en' else "German 🇩🇪"
            target_lang = "German 🇩🇪" if st.session_state.target_language == 'de' else "English 🇺🇸"
            
            st.info(f"**From:** {source_lang}  \n**To:** {target_lang}")
            
            st.divider()
            
            # Session Statistics
            st.subheader("📊 Session Stats")
            stats = st.session_state.session_stats
            
            col1, col2 = st.columns(2)
            with col1:
                st.metric("Translations", stats['translations_count'])
            with col2:
                st.metric("Words", stats['total_words'])
            
            session_duration = datetime.now() - stats['session_start']
            minutes = session_duration.seconds // 60
            seconds = session_duration.seconds % 60
            st.metric("Session Time", f"{minutes}m {seconds}s")
            
            # Clear session
            if st.button("🗑️ Clear Session", use_container_width=True):
                self.clear_session()
    
    def render_main_interface(self):
        """Render main translation interface"""
        # Check if core services are available
        if not self.services_status['translation']:
            st.error("❌ Translation service not available. Please install required dependencies.")
            return
        
        # Voice Input Section
        st.subheader("🎙️ Voice Input")
        
        if self.services_status['speech_recognition']:
            col1, col2, col3 = st.columns([1, 2, 1])
            
            with col2:
                if st.button("🎤 Record Voice", use_container_width=True, type="primary"):
                    self.record_and_translate()
        else:
            st.warning("⚠️ Voice recording not available. Please install SpeechRecognition and pyaudio.")
        
        st.divider()
        
        # Text Input Section
        st.subheader("⌨️ Text Input")
        
        source_lang_name = "English" if st.session_state.source_language == 'en' else "German"
        
        text_input = st.text_area(
            f"Type in {source_lang_name}:",
            height=100,
            placeholder=f"Enter text in {source_lang_name}..."
        )
        
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            if st.button("🔄 Translate Text", use_container_width=True, type="primary") and text_input.strip():
                self.translate_text(text_input.strip())
    
    def render_translation_results(self):
        """Render current translation results"""
        if st.session_state.current_translation:
            st.subheader("📝 Translation Results")
            
            translation = st.session_state.current_translation
            
            # Create two columns for original and translation
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown(f"""
                <div class="translation-box">
                    <h4>🗣️ Original ({self.get_language_name(translation['source_lang'])})</h4>
                    <p style="font-size: 1.1em;">{translation['original_text']}</p>
                </div>
                """, unsafe_allow_html=True)
                
                if self.services_status['tts']:
                    if st.button("🔊 Play Original", key="play_original"):
                        self.speak_text(translation['original_text'], translation['source_lang'])
            
            with col2:
                st.markdown(f"""
                <div class="translation-box">
                    <h4>🔄 Translation ({self.get_language_name(translation['target_lang'])})</h4>
                    <p style="font-size: 1.1em; color: #2b6cb0;">{translation['translated_text']}</p>
                </div>
                """, unsafe_allow_html=True)
                
                if self.services_status['tts']:
                    if st.button("🔊 Play Translation", key="play_translation"):
                        self.speak_text(translation['translated_text'], translation['target_lang'])
            
            # Save to history button
            col1, col2, col3 = st.columns([1, 1, 1])
            with col2:
                if st.button("💾 Save to History", use_container_width=True):
                    self.save_to_history(translation)
                    st.success("✅ Saved to history!")
    
    def render_conversation_history(self):
        """Render conversation history"""
        st.subheader("📚 Conversation History")
        
        if not st.session_state.conversation_history:
            st.info("🗣️ Start translating to see conversation history here")
            return
        
        # History controls
        col1, col2 = st.columns([3, 1])
        with col2:
            if st.button("🗑️ Clear History"):
                st.session_state.conversation_history = []
                st.rerun()
        
        # Display recent history (last 10 items)
        recent_history = list(reversed(st.session_state.conversation_history[-10:]))
        
        for i, item in enumerate(recent_history):
            with st.expander(
                f"💬 {item['timestamp'].strftime('%H:%M:%S')} - "
                f"{self.get_language_name(item['source_lang'])} → {self.get_language_name(item['target_lang'])}"
            ):
                col1, col2 = st.columns(2)
                
                with col1:
                    st.markdown("**Original:**")
                    st.write(item['original_text'])
                    if self.services_status['tts'] and st.button(f"🔊", key=f"play_hist_orig_{i}"):
                        self.speak_text(item['original_text'], item['source_lang'])
                
                with col2:
                    st.markdown("**Translation:**")
                    st.write(item['translated_text'])
                    if self.services_status['tts'] and st.button(f"🔊", key=f"play_hist_trans_{i}"):
                        self.speak_text(item['translated_text'], item['target_lang'])
    
    def record_and_translate(self):
        """Record voice and translate"""
        if not self.services_status['speech_recognition']:
            st.error("❌ Speech recognition not available")
            return
        
        try:
            # Show recording status
            with st.status("🎤 Recording...", expanded=True) as status:
                st.write("Listening for speech...")
                
                with self.microphone as source:
                    self.recognizer.adjust_for_ambient_noise(source, duration=1)
                    st.write("Ambient noise adjusted. Please speak...")
                    
                    # Record with timeout
                    audio = self.recognizer.listen(source, timeout=10, phrase_time_limit=8)
                
                st.write("Processing speech...")
                
                # Convert speech to text
                lang_code = 'en-US' if st.session_state.source_language == 'en' else 'de-DE'
                text = self.recognizer.recognize_google(audio, language=lang_code)
                
                st.write(f"Detected: {text}")
                
                # Translate the text
                if text.strip():
                    self.translate_text(text.strip())
                    status.update(label="✅ Recording complete!", state="complete")
                else:
                    status.update(label="⚠️ No speech detected", state="error")
                    
        except sr.WaitTimeoutError:
            st.warning("⚠️ No speech detected within timeout period")
        except sr.UnknownValueError:
            st.warning("⚠️ Could not understand the audio")
        except sr.RequestError as e:
            st.error(f"❌ Speech recognition service error: {e}")
        except Exception as e:
            st.error(f"❌ Recording failed: {e}")
    
    def translate_text(self, text):
        """Translate text between languages"""
        if not self.services_status['translation']:
            st.error("❌ Translation service not available")
            return
        
        try:
            with st.spinner("🔄 Translating..."):
                # Perform translation
                translation = self.translator.translate(
                    text,
                    src=st.session_state.source_language,
                    dest=st.session_state.target_language
                )
                
                # Create translation result
                translation_result = {
                    'original_text': text,
                    'translated_text': translation.text,
                    'source_lang': st.session_state.source_language,
                    'target_lang': st.session_state.target_language,
                    'timestamp': datetime.now()
                }
                
                # Store in session state
                st.session_state.current_translation = translation_result
                
                # Update statistics
                self.update_session_stats(text)
                
                # Auto-save to history
                self.save_to_history(translation_result)
                
                st.success("✅ Translation completed!")
                
                # Auto-play if TTS is available
                if self.services_status['tts']:
                    self.speak_text(translation.text, st.session_state.target_language)
                
        except Exception as e:
            st.error(f"❌ Translation failed: {e}")
            logger.error(f"Translation error: {e}")
    
    def speak_text(self, text, language):
        """Convert text to speech"""
        if not self.services_status['tts']:
            st.warning("⚠️ Text-to-speech not available")
            return
        
        try:
            # Configure voice for language
            voices = self.tts_engine.getProperty('voices')
            
            # Try to set appropriate voice
            for voice in voices:
                voice_name = voice.name.lower()
                if language == 'en' and ('english' in voice_name or 'en' in voice.id.lower()):
                    self.tts_engine.setProperty('voice', voice.id)
                    break
                elif language == 'de' and ('german' in voice_name or 'de' in voice.id.lower()):
                    self.tts_engine.setProperty('voice', voice.id)
                    break
            
            # Speak the text
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
            
        except Exception as e:
            st.error(f"❌ Text-to-speech failed: {e}")
    
    def save_to_history(self, translation):
        """Save translation to conversation history"""
        # Check if already in history (avoid duplicates)
        for item in st.session_state.conversation_history:
            if (item['original_text'] == translation['original_text'] and 
                item['translated_text'] == translation['translated_text']):
                return
        
        # Add to history
        st.session_state.conversation_history.append(translation)
        
        # Limit history size
        if len(st.session_state.conversation_history) > 100:
            st.session_state.conversation_history = st.session_state.conversation_history[-100:]
    
    def update_session_stats(self, text):
        """Update session statistics"""
        st.session_state.session_stats['translations_count'] += 1
        st.session_state.session_stats['total_words'] += len(text.split())
    
    def clear_session(self):
        """Clear all session data"""
        st.session_state.conversation_history = []
        st.session_state.current_translation = None
        st.session_state.session_stats = {
            'translations_count': 0,
            'session_start': datetime.now(),
            'total_words': 0
        }
        st.success("🗑️ Session cleared!")
        st.rerun()
    
    def get_language_name(self, code):
        """Get full language name from code"""
        return "English" if code == 'en' else "German"
    
    def render_features_showcase(self):
        """Render features showcase when dependencies are missing"""
        st.subheader("🌟 Application Features")
        
        features = [
            ("🎙️ Voice Recording", "Record your voice and get instant translation"),
            ("⌨️ Text Input", "Type text for translation when voice isn't available"),
            ("🔊 Audio Playback", "Hear translations in natural speech"),
            ("📚 Conversation History", "Track all your translations in one place"),
            ("🌍 Bidirectional Translation", "Switch between English and German easily"),
            ("📊 Session Statistics", "Monitor your translation activity")
        ]
        
        cols = st.columns(2)
        for i, (title, description) in enumerate(features):
            with cols[i % 2]:
                st.markdown(f"""
                <div class="feature-card">
                    <h4>{title}</h4>
                    <p>{description}</p>
                </div>
                """, unsafe_allow_html=True)
    
    def render_footer(self):
        """Render application footer"""
        st.markdown("""
        <div class="footer">
            <hr>
            <p>🗣️ <strong>Voice Translator</strong> | Built with ❤️ using Streamlit</p>
            <p>Real-time English ⇄ German communication made simple</p>
            <p><small>Powered by Google Translate API & Speech Recognition</small></p>
        </div>
        """, unsafe_allow_html=True)
    
    def run(self):
        """Main application runner"""
        try:
            # Render header
            self.render_header()
            
            # Check dependencies
            dependencies_ok = self.check_dependencies()
            
            # Render sidebar
            self.render_sidebar()
            
            if dependencies_ok:
                # Main interface
                self.render_main_interface()
                self.render_translation_results()
                self.render_conversation_history()
            else:
                # Show features when dependencies are missing
                self.render_features_showcase()
            
            # Footer
            self.render_footer()
            
        except Exception as e:
            st.error(f"❌ Application error: {e}")
            logger.error(f"Application error: {e}")

def main():
    """Application entry point"""
    try:
        app = VoiceTranslatorApp()
        app.run()
        
    except Exception as e:
        st.error(f"❌ Failed to start application: {e}")
        logger.error(f"Application startup error: {e}")
        
        # Show basic installation guide
        st.markdown("### Quick Setup Guide")
        st.code("""
# Install dependencies
pip install streamlit
pip install SpeechRecognition
pip install googletrans==4.0.0rc1
pip install pyttsx3

# Run the application
streamlit run streamlit_app_simple.py
        """, language="bash")

if __name__ == "__main__":
    main()
