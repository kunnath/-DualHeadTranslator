#!/usr/bin/env python3
"""
Real-Time Voice Translator - Streamlit Application
A modern voice translation app enabling seamless English ⇄ German communication
"""

import streamlit as st
import speech_recognition as sr
import pyttsx3
from googletrans import Translator
import tempfile
import os
import io
import threading
import time
import base64
from pathlib import Path
import requests
import json
from datetime import datetime
import queue
import numpy as np
import sounddevice as sd
import scipy.io.wavfile as wav
import asyncio
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VoiceTranslatorApp:
    """Modern Voice Translation Application with Streamlit"""
    
    def __init__(self):
        self.setup_page_config()
        self.initialize_services()
        self.setup_session_state()
        
    def setup_page_config(self):
        """Configure Streamlit page settings"""
        st.set_page_config(
            page_title="🗣️ Voice Translator | English ⇄ German",
            page_icon="🗣️",
            layout="wide",
            initial_sidebar_state="expanded"
        )
        
        # Custom CSS for modern UI
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
        
        .language-card {
            background: linear-gradient(135deg, #f8fafc, #e2e8f0);
            padding: 1.5rem;
            border-radius: 15px;
            border: 2px solid #e2e8f0;
            text-align: center;
            margin: 1rem 0;
            transition: all 0.3s ease;
        }
        
        .language-card:hover {
            border-color: #667eea;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
            transform: translateY(-2px);
        }
        
        .translation-box {
            background: white;
            padding: 1.5rem;
            border-radius: 15px;
            border-left: 4px solid #667eea;
            margin: 1rem 0;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .history-item {
            background: #f8fafc;
            padding: 1rem;
            border-radius: 10px;
            margin: 0.5rem 0;
            border-left: 3px solid #48bb78;
        }
        
        .audio-controls {
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin: 1rem 0;
        }
        
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }
        
        .status-connected { background-color: #48bb78; }
        .status-recording { background-color: #f56565; animation: pulse 1s infinite; }
        .status-processing { background-color: #ed8936; }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .metric-card {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 1rem;
            border-radius: 10px;
            text-align: center;
            margin: 0.5rem;
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            color: #718096;
            margin-top: 3rem;
        }
        </style>
        """, unsafe_allow_html=True)
    
    def initialize_services(self):
        """Initialize translation and speech services"""
        try:
            # Speech Recognition
            self.recognizer = sr.Recognizer()
            self.microphone = sr.Microphone()
            
            # Text-to-Speech
            self.tts_engine = pyttsx3.init()
            voices = self.tts_engine.getProperty('voices')
            
            # Set voice properties
            self.tts_engine.setProperty('rate', 150)
            self.tts_engine.setProperty('volume', 0.9)
            
            # Translation
            self.translator = Translator()
            
            # Audio recording setup
            self.sample_rate = 16000
            self.channels = 1
            self.recording = False
            self.audio_queue = queue.Queue()
            
            logger.info("Services initialized successfully")
            
        except Exception as e:
            logger.error(f"Service initialization error: {e}")
            st.error(f"Failed to initialize services: {e}")
    
    def setup_session_state(self):
        """Initialize Streamlit session state variables"""
        if 'conversation_history' not in st.session_state:
            st.session_state.conversation_history = []
            
        if 'source_language' not in st.session_state:
            st.session_state.source_language = 'en'
            
        if 'target_language' not in st.session_state:
            st.session_state.target_language = 'de'
            
        if 'is_recording' not in st.session_state:
            st.session_state.is_recording = False
            
        if 'last_translation' not in st.session_state:
            st.session_state.last_translation = None
            
        if 'session_stats' not in st.session_state:
            st.session_state.session_stats = {
                'translations_count': 0,
                'session_start': datetime.now(),
                'total_words': 0
            }
    
    def render_header(self):
        """Render the main application header"""
        st.markdown("""
        <div class="main-header">
            <h1>🗣️ Real-Time Voice Translator</h1>
            <h3>English ⇄ German • Seamless Communication</h3>
            <p>Speak naturally, understand instantly</p>
        </div>
        """, unsafe_allow_html=True)
    
    def render_sidebar(self):
        """Render sidebar with controls and settings"""
        with st.sidebar:
            st.title("🎛️ Controls")
            
            # Language Selection
            st.subheader("🌍 Language Settings")
            
            col1, col2 = st.columns(2)
            
            with col1:
                if st.button("🇺🇸 English → German", use_container_width=True):
                    st.session_state.source_language = 'en'
                    st.session_state.target_language = 'de'
                    
            with col2:
                if st.button("🇩🇪 German → English", use_container_width=True):
                    st.session_state.source_language = 'de'
                    st.session_state.target_language = 'en'
            
            # Current language status
            source_lang = "English 🇺🇸" if st.session_state.source_language == 'en' else "German 🇩🇪"
            target_lang = "German 🇩🇪" if st.session_state.target_language == 'de' else "English 🇺🇸"
            
            st.info(f"**Speaking:** {source_lang}  \n**Translating to:** {target_lang}")
            
            # Audio Settings
            st.subheader("🎙️ Audio Settings")
            
            # Microphone test
            if st.button("🎤 Test Microphone", use_container_width=True):
                self.test_microphone()
            
            # Voice settings
            speech_rate = st.slider("Speech Rate", 100, 300, 150)
            self.tts_engine.setProperty('rate', speech_rate)
            
            # Session Statistics
            st.subheader("📊 Session Stats")
            stats = st.session_state.session_stats
            
            col1, col2 = st.columns(2)
            with col1:
                st.metric("Translations", stats['translations_count'])
            with col2:
                st.metric("Words", stats['total_words'])
            
            session_duration = datetime.now() - stats['session_start']
            st.metric("Session Time", f"{session_duration.seconds // 60}m {session_duration.seconds % 60}s")
            
            # Clear session
            if st.button("🗑️ Clear Session", use_container_width=True):
                self.clear_session()
    
    def render_main_interface(self):
        """Render the main translation interface"""
        col1, col2, col3 = st.columns([1, 2, 1])
        
        with col2:
            # Voice Recording Interface
            st.subheader("🎙️ Voice Input")
            
            # Recording status
            status_html = self.get_status_indicator()
            st.markdown(status_html, unsafe_allow_html=True)
            
            # Recording controls
            col_rec1, col_rec2, col_rec3 = st.columns([1, 2, 1])
            
            with col_rec2:
                if not st.session_state.is_recording:
                    if st.button("🎙️ Start Recording", use_container_width=True, type="primary"):
                        self.start_recording()
                else:
                    if st.button("⏹️ Stop Recording", use_container_width=True, type="secondary"):
                        self.stop_recording()
            
            # Alternative input methods
            st.subheader("⌨️ Text Input")
            text_input = st.text_area(
                f"Type in {self.get_language_name(st.session_state.source_language)}:",
                height=100,
                placeholder=f"Enter text in {self.get_language_name(st.session_state.source_language)}..."
            )
            
            if st.button("🔄 Translate Text", use_container_width=True) and text_input:
                self.translate_text(text_input)
    
    def render_translation_results(self):
        """Render translation results and history"""
        # Current Translation
        if st.session_state.last_translation:
            st.subheader("📝 Translation Results")
            
            translation = st.session_state.last_translation
            
            # Original text
            st.markdown(f"""
            <div class="translation-box">
                <h4>🗣️ Original ({self.get_language_name(translation['source_lang'])})</h4>
                <p style="font-size: 1.2em;">{translation['original_text']}</p>
            </div>
            """, unsafe_allow_html=True)
            
            # Translated text
            st.markdown(f"""
            <div class="translation-box">
                <h4>🔄 Translation ({self.get_language_name(translation['target_lang'])})</h4>
                <p style="font-size: 1.2em; color: #2b6cb0;">{translation['translated_text']}</p>
            </div>
            """, unsafe_allow_html=True)
            
            # Audio playback controls
            col1, col2, col3 = st.columns([1, 1, 1])
            
            with col1:
                if st.button("🔊 Play Original", use_container_width=True):
                    self.speak_text(translation['original_text'], translation['source_lang'])
            
            with col2:
                if st.button("🔊 Play Translation", use_container_width=True):
                    self.speak_text(translation['translated_text'], translation['target_lang'])
            
            with col3:
                if st.button("💾 Save to History", use_container_width=True):
                    self.save_to_history(translation)
        
        # Conversation History
        self.render_conversation_history()
    
    def render_conversation_history(self):
        """Render conversation history"""
        st.subheader("📚 Conversation History")
        
        if not st.session_state.conversation_history:
            st.info("🗣️ Start a conversation to see history here")
            return
        
        # History controls
        col1, col2 = st.columns([3, 1])
        with col2:
            if st.button("🗑️ Clear History"):
                st.session_state.conversation_history = []
                st.rerun()
        
        # Display history items
        for i, item in enumerate(reversed(st.session_state.conversation_history[-10:])):  # Show last 10
            with st.expander(f"💬 {item['timestamp'].strftime('%H:%M:%S')} - {self.get_language_name(item['source_lang'])} → {self.get_language_name(item['target_lang'])}"):
                
                col1, col2 = st.columns(2)
                
                with col1:
                    st.markdown("**Original:**")
                    st.write(item['original_text'])
                    if st.button(f"🔊 Play", key=f"play_orig_{i}"):
                        self.speak_text(item['original_text'], item['source_lang'])
                
                with col2:
                    st.markdown("**Translation:**")
                    st.write(item['translated_text'])
                    if st.button(f"🔊 Play", key=f"play_trans_{i}"):
                        self.speak_text(item['translated_text'], item['target_lang'])
    
    def get_status_indicator(self):
        """Get HTML for status indicator"""
        if st.session_state.is_recording:
            return """
            <div style="text-align: center; margin: 1rem 0;">
                <span class="status-indicator status-recording"></span>
                <span style="color: #f56565; font-weight: bold;">🔴 Recording...</span>
            </div>
            """
        else:
            return """
            <div style="text-align: center; margin: 1rem 0;">
                <span class="status-indicator status-connected"></span>
                <span style="color: #48bb78; font-weight: bold;">🟢 Ready to record</span>
            </div>
            """
    
    def get_language_name(self, code):
        """Get language name from code"""
        return "English" if code == 'en' else "German"
    
    def test_microphone(self):
        """Test microphone functionality"""
        try:
            with self.microphone as source:
                st.info("🎤 Testing microphone... Please speak something")
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
                audio = self.recognizer.listen(source, timeout=3, phrase_time_limit=3)
                
            text = self.recognizer.recognize_google(audio)
            st.success(f"✅ Microphone test successful! Detected: '{text}'")
            
        except sr.RequestError:
            st.error("❌ Could not request results from speech recognition service")
        except sr.UnknownValueError:
            st.warning("⚠️ Could not understand audio")
        except Exception as e:
            st.error(f"❌ Microphone test failed: {e}")
    
    def start_recording(self):
        """Start voice recording"""
        try:
            st.session_state.is_recording = True
            
            # Create a placeholder for dynamic updates
            status_placeholder = st.empty()
            result_placeholder = st.empty()
            
            with status_placeholder.container():
                st.info("🎤 Recording... Speak clearly into your microphone")
            
            # Record audio
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = self.recognizer.listen(source, timeout=10, phrase_time_limit=8)
            
            with status_placeholder.container():
                st.info("🔄 Processing speech...")
            
            # Convert speech to text
            text = self.speech_to_text(audio)
            
            if text:
                # Translate the text
                self.translate_text(text)
                status_placeholder.empty()
            else:
                with result_placeholder.container():
                    st.warning("⚠️ No speech detected. Please try again.")
            
        except sr.WaitTimeoutError:
            st.warning("⚠️ No speech detected within timeout period")
        except Exception as e:
            st.error(f"❌ Recording failed: {e}")
        finally:
            st.session_state.is_recording = False
    
    def stop_recording(self):
        """Stop voice recording"""
        st.session_state.is_recording = False
        st.info("⏹️ Recording stopped")
    
    def speech_to_text(self, audio):
        """Convert speech to text"""
        try:
            # Determine language for recognition
            lang_code = 'en-US' if st.session_state.source_language == 'en' else 'de-DE'
            
            # Use Google Speech Recognition
            text = self.recognizer.recognize_google(audio, language=lang_code)
            return text
            
        except sr.UnknownValueError:
            st.warning("⚠️ Could not understand the audio")
            return None
        except sr.RequestError as e:
            st.error(f"❌ Speech recognition error: {e}")
            return None
    
    def translate_text(self, text):
        """Translate text between languages"""
        try:
            # Translate using Google Translate
            translation = self.translator.translate(
                text, 
                src=st.session_state.source_language,
                dest=st.session_state.target_language
            )
            
            # Store translation result
            translation_result = {
                'original_text': text,
                'translated_text': translation.text,
                'source_lang': st.session_state.source_language,
                'target_lang': st.session_state.target_language,
                'timestamp': datetime.now()
            }
            
            st.session_state.last_translation = translation_result
            
            # Update statistics
            self.update_session_stats(text)
            
            # Auto-save to history
            self.save_to_history(translation_result)
            
            st.success("✅ Translation completed!")
            
            # Auto-play translation
            self.speak_text(translation.text, st.session_state.target_language)
            
        except Exception as e:
            st.error(f"❌ Translation failed: {e}")
    
    def speak_text(self, text, language):
        """Convert text to speech"""
        try:
            # Set voice based on language
            voices = self.tts_engine.getProperty('voices')
            
            # Try to find appropriate voice for language
            for voice in voices:
                if language == 'en' and ('english' in voice.name.lower() or 'en' in voice.id.lower()):
                    self.tts_engine.setProperty('voice', voice.id)
                    break
                elif language == 'de' and ('german' in voice.name.lower() or 'de' in voice.id.lower()):
                    self.tts_engine.setProperty('voice', voice.id)
                    break
            
            # Speak the text
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
            
        except Exception as e:
            st.error(f"❌ Text-to-speech failed: {e}")
    
    def save_to_history(self, translation):
        """Save translation to history"""
        if translation not in st.session_state.conversation_history:
            st.session_state.conversation_history.append(translation)
            
            # Limit history size
            if len(st.session_state.conversation_history) > 50:
                st.session_state.conversation_history = st.session_state.conversation_history[-50:]
    
    def update_session_stats(self, text):
        """Update session statistics"""
        st.session_state.session_stats['translations_count'] += 1
        st.session_state.session_stats['total_words'] += len(text.split())
    
    def clear_session(self):
        """Clear session data"""
        st.session_state.conversation_history = []
        st.session_state.last_translation = None
        st.session_state.session_stats = {
            'translations_count': 0,
            'session_start': datetime.now(),
            'total_words': 0
        }
        st.success("🗑️ Session data cleared!")
    
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
            # Render main components
            self.render_header()
            self.render_sidebar()
            
            # Main content area
            self.render_main_interface()
            self.render_translation_results()
            
            # Footer
            self.render_footer()
            
        except Exception as e:
            st.error(f"❌ Application error: {e}")
            logger.error(f"Application error: {e}")

def main():
    """Main application entry point"""
    try:
        app = VoiceTranslatorApp()
        app.run()
        
    except Exception as e:
        st.error(f"❌ Failed to start application: {e}")
        logger.error(f"Application startup error: {e}")

if __name__ == "__main__":
    main()
