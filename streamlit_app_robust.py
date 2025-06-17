#!/usr/bin/env python3
"""
Streamlit Voice Translator - Robust Version
Handles missing dependencies gracefully with fallback options
"""

import streamlit as st
import sys
import os
import tempfile
import threading
import time
import json
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set page config first
st.set_page_config(
    page_title="🗣️ Voice Translator | English ⇄ German",
    page_icon="🗣️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Check for required imports
missing_libs = []
available_services = {}

# Test Streamlit (already imported if we got here)
available_services['streamlit'] = True

# Test Speech Recognition
try:
    import speech_recognition as sr
    available_services['speech_recognition'] = True
except ImportError:
    missing_libs.append("SpeechRecognition")
    available_services['speech_recognition'] = False

# Test Text-to-Speech
try:
    import pyttsx3
    available_services['tts'] = True
except ImportError:
    missing_libs.append("pyttsx3")
    available_services['tts'] = False

# Test Translation (multiple options)
available_services['translation'] = False
translation_service = None

try:
    from deep_translator import GoogleTranslator
    available_services['translation'] = True
    translation_service = "deep_translator"
    st.sidebar.success("✅ Translation: deep-translator")
except ImportError:
    try:
        from translate import Translator
        available_services['translation'] = True
        translation_service = "translate"
        st.sidebar.success("✅ Translation: translate library")
    except ImportError:
        try:
            import requests
            # Test if we can use MyMemory API
            response = requests.get("https://api.mymemory.translated.net/get?q=hello&langpair=en|de", timeout=5)
            if response.status_code == 200:
                available_services['translation'] = True
                translation_service = "mymemory"
                st.sidebar.success("✅ Translation: MyMemory API")
        except:
            missing_libs.append("Translation service")
            available_services['translation'] = False
            st.sidebar.error("❌ No translation service available")

# Test NumPy (optional)
try:
    import numpy as np
    available_services['numpy'] = True
except ImportError:
    available_services['numpy'] = False

class VoiceTranslatorApp:
    """Robust Voice Translation Application"""
    
    def __init__(self):
        self.setup_session_state()
        self.setup_styles()
        self.initialize_services()
        self.setup_backup_translations()
        
    def setup_session_state(self):
        """Initialize session state"""
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
    
    def setup_backup_translations(self):
        """Setup backup translation dictionary"""
        self.backup_translations = {
            'en-de': {
                'hello': 'hallo',
                'goodbye': 'auf wiedersehen', 
                'thank you': 'danke',
                'please': 'bitte',
                'yes': 'ja',
                'no': 'nein',
                'how are you': 'wie geht es dir',
                'good morning': 'guten morgen',
                'good evening': 'guten abend',
                'excuse me': 'entschuldigung',
                'i love you': 'ich liebe dich',
                'where is': 'wo ist',
                'how much': 'wie viel',
                'what time': 'wie spät',
                'help me': 'hilf mir',
                'i need': 'ich brauche',
                'water': 'wasser',
                'food': 'essen',
                'bathroom': 'badezimmer',
                'hotel': 'hotel',
                'restaurant': 'restaurant',
                'train station': 'bahnhof',
                'airport': 'flughafen',
                'hospital': 'krankenhaus',
                'emergency': 'notfall',
                'police': 'polizei'
            },
            'de-en': {
                'hallo': 'hello',
                'auf wiedersehen': 'goodbye',
                'danke': 'thank you',
                'bitte': 'please',
                'ja': 'yes',
                'nein': 'no',
                'wie geht es dir': 'how are you',
                'guten morgen': 'good morning',
                'guten abend': 'good evening',
                'entschuldigung': 'excuse me',
                'ich liebe dich': 'i love you',
                'wo ist': 'where is',
                'wie viel': 'how much',
                'wie spät': 'what time',
                'hilf mir': 'help me',
                'ich brauche': 'i need',
                'wasser': 'water',
                'essen': 'food',
                'badezimmer': 'bathroom',
                'hotel': 'hotel',
                'restaurant': 'restaurant',
                'bahnhof': 'train station',
                'flughafen': 'airport',
                'krankenhaus': 'hospital',
                'notfall': 'emergency',
                'polizei': 'police'
            }
        }
    
    def setup_styles(self):
        """Setup custom CSS"""
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
        
        .service-status {
            background: #f8fafc;
            padding: 1rem;
            border-radius: 10px;
            border-left: 4px solid #48bb78;
            margin: 0.5rem 0;
        }
        
        .service-error {
            background: #fed7d7;
            padding: 1rem;
            border-radius: 10px;
            border-left: 4px solid #f56565;
            margin: 0.5rem 0;
        }
        
        .translation-box {
            background: white;
            padding: 1.5rem;
            border-radius: 15px;
            border-left: 4px solid #667eea;
            margin: 1rem 0;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .backup-translation {
            background: #fef5e7;
            padding: 1rem;
            border-radius: 10px;
            border-left: 4px solid #ed8936;
            margin: 1rem 0;
        }
        
        .installation-help {
            background: #2d3748;
            color: #e2e8f0;
            padding: 1rem;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            margin: 1rem 0;
        }
        </style>
        """, unsafe_allow_html=True)
    
    def initialize_services(self):
        """Initialize available services"""
        self.services = available_services.copy()
        
        if self.services['speech_recognition']:
            try:
                self.recognizer = sr.Recognizer()
                self.microphone = sr.Microphone()
            except Exception as e:
                logger.error(f"Speech recognition setup error: {e}")
                self.services['speech_recognition'] = False
        
        if self.services['tts']:
            try:
                self.tts_engine = pyttsx3.init()
                self.tts_engine.setProperty('rate', 150)
                self.tts_engine.setProperty('volume', 0.9)
            except Exception as e:
                logger.error(f"TTS setup error: {e}")
                self.services['tts'] = False
    
    def render_header(self):
        """Render header"""
        st.markdown("""
        <div class="main-header">
            <h1>🗣️ Voice Translator</h1>
            <h3>English ⇄ German • Seamless Communication</h3>
            <p>Speak naturally, understand instantly</p>
        </div>
        """, unsafe_allow_html=True)
    
    def render_service_status(self):
        """Show service status"""
        st.subheader("🔧 Service Status")
        
        services = [
            ("Streamlit", self.services.get('streamlit', True)),
            ("Speech Recognition", self.services.get('speech_recognition', False)),
            ("Text-to-Speech", self.services.get('tts', False)),
            ("Translation", self.services.get('translation', False))
        ]
        
        all_working = True
        for service_name, status in services:
            if status:
                st.success(f"✅ {service_name}")
            else:
                st.error(f"❌ {service_name}")
                all_working = False
        
        if not all_working and missing_libs:
            with st.expander("🔧 Fix Missing Dependencies", expanded=True):
                st.markdown("### Install missing packages:")
                
                install_cmd = "pip install " + " ".join([
                    "SpeechRecognition" if "SpeechRecognition" in missing_libs else "",
                    "pyttsx3" if "pyttsx3" in missing_libs else "",
                    "deep-translator" if "Translation service" in missing_libs else ""
                ]).strip()
                
                st.code(install_cmd, language="bash")
                
                st.markdown("### Alternative installation:")
                st.code("pip install -r requirements.txt", language="bash")
                
                st.info("💡 After installing, restart the application")
    
    def render_sidebar(self):
        """Render sidebar"""
        with st.sidebar:
            st.title("🎛️ Controls")
            
            # Service status in sidebar
            self.render_service_status()
            
            st.divider()
            
            # Language selection
            st.subheader("🌍 Languages")
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("🇺🇸 EN→DE", use_container_width=True):
                    st.session_state.source_language = 'en'
                    st.session_state.target_language = 'de'
                    
            with col2:
                if st.button("🇩🇪 DE→EN", use_container_width=True):
                    st.session_state.source_language = 'de'
                    st.session_state.target_language = 'en'
            
            # Current settings
            source = "English 🇺🇸" if st.session_state.source_language == 'en' else "German 🇩🇪"
            target = "German 🇩🇪" if st.session_state.target_language == 'de' else "English 🇺🇸"
            st.info(f"**From:** {source}  \n**To:** {target}")
            
            st.divider()
            
            # Session stats
            st.subheader("📊 Stats")
            stats = st.session_state.session_stats
            
            col1, col2 = st.columns(2)
            with col1:
                st.metric("Translations", stats['translations_count'])
            with col2:
                st.metric("Words", stats['total_words'])
            
            if st.button("🗑️ Clear Session", use_container_width=True):
                self.clear_session()
    
    def render_main_interface(self):
        """Main interface"""
        # Voice input
        st.subheader("🎙️ Voice Input")
        
        if self.services['speech_recognition']:
            col1, col2, col3 = st.columns([1, 2, 1])
            with col2:
                if st.button("🎤 Record Voice", use_container_width=True, type="primary"):
                    self.record_and_translate()
        else:
            st.warning("⚠️ Voice recording not available. Install SpeechRecognition package.")
        
        st.divider()
        
        # Text input
        st.subheader("⌨️ Text Input")
        
        source_lang = "English" if st.session_state.source_language == 'en' else "German"
        text_input = st.text_area(
            f"Type in {source_lang}:",
            height=100,
            placeholder=f"Enter text in {source_lang}..."
        )
        
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            if st.button("🔄 Translate", use_container_width=True, type="primary") and text_input.strip():
                self.translate_text(text_input.strip())
    
    def render_translation_results(self):
        """Show translation results"""
        if st.session_state.current_translation:
            st.subheader("📝 Translation Results")
            
            translation = st.session_state.current_translation
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown(f"""
                <div class="translation-box">
                    <h4>🗣️ Original ({self.get_language_name(translation['source_lang'])})</h4>
                    <p style="font-size: 1.1em;">{translation['original_text']}</p>
                </div>
                """, unsafe_allow_html=True)
                
                if self.services['tts'] and st.button("🔊 Play Original", key="play_orig"):
                    self.speak_text(translation['original_text'], translation['source_lang'])
            
            with col2:
                style_class = "backup-translation" if translation.get('is_backup') else "translation-box"
                st.markdown(f"""
                <div class="{style_class}">
                    <h4>🔄 Translation ({self.get_language_name(translation['target_lang'])})</h4>
                    <p style="font-size: 1.1em; color: #2b6cb0;">{translation['translated_text']}</p>
                    {f'<small>ℹ️ Basic translation used</small>' if translation.get('is_backup') else ''}
                </div>
                """, unsafe_allow_html=True)
                
                if self.services['tts'] and st.button("🔊 Play Translation", key="play_trans"):
                    self.speak_text(translation['translated_text'], translation['target_lang'])
            
            # Save button
            col1, col2, col3 = st.columns([1, 1, 1])
            with col2:
                if st.button("💾 Save to History", use_container_width=True):
                    self.save_to_history(translation)
                    st.success("✅ Saved!")
    
    def render_conversation_history(self):
        """Show conversation history"""
        st.subheader("📚 Conversation History")
        
        if not st.session_state.conversation_history:
            st.info("🗣️ Start translating to see history")
            return
        
        # Clear button
        col1, col2 = st.columns([3, 1])
        with col2:
            if st.button("🗑️ Clear"):
                st.session_state.conversation_history = []
                st.rerun()
        
        # Show recent history
        recent = list(reversed(st.session_state.conversation_history[-5:]))
        
        for i, item in enumerate(recent):
            with st.expander(
                f"💬 {item['timestamp'].strftime('%H:%M')} - "
                f"{self.get_language_name(item['source_lang'])} → {self.get_language_name(item['target_lang'])}"
            ):
                col1, col2 = st.columns(2)
                
                with col1:
                    st.write("**Original:**")
                    st.write(item['original_text'])
                
                with col2:
                    st.write("**Translation:**")
                    st.write(item['translated_text'])
    
    def record_and_translate(self):
        """Record voice and translate"""
        if not self.services['speech_recognition']:
            st.error("❌ Speech recognition not available")
            return
        
        try:
            with st.status("🎤 Recording...", expanded=True) as status:
                st.write("Listening...")
                
                with self.microphone as source:
                    self.recognizer.adjust_for_ambient_noise(source, duration=1)
                    st.write("Please speak clearly...")
                    audio = self.recognizer.listen(source, timeout=10, phrase_time_limit=8)
                
                st.write("Processing...")
                
                lang_code = 'en-US' if st.session_state.source_language == 'en' else 'de-DE'
                text = self.recognizer.recognize_google(audio, language=lang_code)
                
                st.write(f"Heard: {text}")
                
                if text.strip():
                    self.translate_text(text.strip())
                    status.update(label="✅ Complete!", state="complete")
                    
        except sr.WaitTimeoutError:
            st.warning("⚠️ No speech detected")
        except sr.UnknownValueError:
            st.warning("⚠️ Could not understand audio")
        except Exception as e:
            st.error(f"❌ Recording failed: {e}")
    
    def translate_text(self, text):
        """Translate text using available service"""
        try:
            with st.spinner("🔄 Translating..."):
                translated_text = None
                is_backup = False
                
                if self.services['translation']:
                    if translation_service == "deep_translator":
                        translator = GoogleTranslator(
                            source=st.session_state.source_language,
                            target=st.session_state.target_language
                        )
                        translated_text = translator.translate(text)
                    
                    elif translation_service == "translate":
                        translator = Translator(
                            from_lang=st.session_state.source_language,
                            to_lang=st.session_state.target_language
                        )
                        translated_text = translator.translate(text)
                    
                    elif translation_service == "mymemory":
                        translated_text = self.translate_with_mymemory(text)
                
                # Fallback to backup translations
                if not translated_text:
                    translated_text = self.backup_translate(text)
                    is_backup = True
                
                if translated_text:
                    result = {
                        'original_text': text,
                        'translated_text': translated_text,
                        'source_lang': st.session_state.source_language,
                        'target_lang': st.session_state.target_language,
                        'timestamp': datetime.now(),
                        'is_backup': is_backup
                    }
                    
                    st.session_state.current_translation = result
                    self.update_session_stats(text)
                    self.save_to_history(result)
                    
                    st.success("✅ Translation complete!")
                    
                    if self.services['tts']:
                        self.speak_text(translated_text, st.session_state.target_language)
                else:
                    st.error("❌ Translation failed")
                    
        except Exception as e:
            st.error(f"❌ Translation error: {e}")
    
    def translate_with_mymemory(self, text):
        """Translate using MyMemory API"""
        try:
            import requests
            
            url = "https://api.mymemory.translated.net/get"
            params = {
                'q': text,
                'langpair': f"{st.session_state.source_language}|{st.session_state.target_language}"
            }
            
            response = requests.get(url, params=params, timeout=10)
            data = response.json()
            
            if data['responseStatus'] == 200:
                return data['responseData']['translatedText']
            
        except Exception as e:
            logger.error(f"MyMemory translation error: {e}")
        
        return None
    
    def backup_translate(self, text):
        """Backup translation using dictionary"""
        key = f"{st.session_state.source_language}-{st.session_state.target_language}"
        translations = self.backup_translations.get(key, {})
        
        text_lower = text.lower().strip()
        
        # Exact match
        if text_lower in translations:
            return translations[text_lower]
        
        # Partial match
        for original, translated in translations.items():
            if original in text_lower:
                return text.lower().replace(original, translated)
        
        return f"[Translation needed: {text}]"
    
    def speak_text(self, text, language):
        """Text-to-speech"""
        if not self.services['tts']:
            st.warning("⚠️ Text-to-speech not available")
            return
        
        try:
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
        except Exception as e:
            st.error(f"❌ Speech failed: {e}")
    
    def save_to_history(self, translation):
        """Save to history"""
        if translation not in st.session_state.conversation_history:
            st.session_state.conversation_history.append(translation)
            
            if len(st.session_state.conversation_history) > 50:
                st.session_state.conversation_history = st.session_state.conversation_history[-50:]
    
    def update_session_stats(self, text):
        """Update stats"""
        st.session_state.session_stats['translations_count'] += 1
        st.session_state.session_stats['total_words'] += len(text.split())
    
    def clear_session(self):
        """Clear session"""
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
        """Get language name"""
        return "English" if code == 'en' else "German"
    
    def run(self):
        """Main app runner"""
        try:
            self.render_header()
            self.render_sidebar()
            self.render_main_interface()
            self.render_translation_results()
            self.render_conversation_history()
            
            # Footer
            st.markdown("---")
            st.markdown("🗣️ **Voice Translator** | Built with ❤️ using Streamlit")
            
        except Exception as e:
            st.error(f"❌ App error: {e}")

def main():
    """Main function"""
    try:
        app = VoiceTranslatorApp()
        app.run()
    except Exception as e:
        st.error(f"❌ Failed to start: {e}")
        
        st.markdown("### Quick Fix")
        st.code("pip install streamlit deep-translator SpeechRecognition pyttsx3", language="bash")

if __name__ == "__main__":
    main()
