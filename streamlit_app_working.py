#!/usr/bin/env python3
"""
Streamlit Voice Translator - Working Version
A reliable voice translation app with fallback translation methods
"""

import streamlit as st
import sys
import os
import logging
from datetime import datetime
import json
import requests
import re

# Set page config first
st.set_page_config(
    page_title="🗣️ Voice Translator | English ⇄ German",
    page_icon="🗣️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Check for required imports
try:
    import speech_recognition as sr
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False

try:
    import pyttsx3
    TTS_AVAILABLE = True
except ImportError:
    TTS_AVAILABLE = False

# Simple translation service using multiple backends
class SimpleTranslator:
    """Simple translation service with multiple backends"""
    
    def __init__(self):
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
                'police': 'polizei',
                'one': 'eins',
                'two': 'zwei',
                'three': 'drei',
                'four': 'vier',
                'five': 'fünf',
                'six': 'sechs',
                'seven': 'sieben',
                'eight': 'acht',
                'nine': 'neun',
                'ten': 'zehn'
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
                'polizei': 'police',
                'eins': 'one',
                'zwei': 'two',
                'drei': 'three',
                'vier': 'four',
                'fünf': 'five',
                'sechs': 'six',
                'sieben': 'seven',
                'acht': 'eight',
                'neun': 'nine',
                'zehn': 'ten'
            }
        }
    
    def translate(self, text, src='en', dest='de'):
        """Translate text with fallback methods"""
        try:
            # Method 1: Try MyMemory API (free)
            result = self.translate_with_mymemory(text, src, dest)
            if result:
                return MockTranslation(result, src, dest)
        except:
            pass
        
        try:
            # Method 2: Try LibreTranslate API (if available)
            result = self.translate_with_libre(text, src, dest)
            if result:
                return MockTranslation(result, src, dest)
        except:
            pass
        
        # Method 3: Fallback to dictionary
        result = self.translate_with_dict(text, src, dest)
        return MockTranslation(result, src, dest)
    
    def translate_with_mymemory(self, text, src, dest):
        """Translate using MyMemory API"""
        try:
            url = "https://api.mymemory.translated.net/get"
            params = {
                'q': text,
                'langpair': f'{src}|{dest}'
            }
            response = requests.get(url, params=params, timeout=5)
            data = response.json()
            
            if data.get('responseStatus') == 200:
                return data['responseData']['translatedText']
        except:
            pass
        return None
    
    def translate_with_libre(self, text, src, dest):
        """Translate using LibreTranslate API (demo instance)"""
        try:
            url = "https://libretranslate.de/translate"
            data = {
                'q': text,
                'source': src,
                'target': dest,
                'format': 'text'
            }
            response = requests.post(url, data=data, timeout=5)
            result = response.json()
            
            if 'translatedText' in result:
                return result['translatedText']
        except:
            pass
        return None
    
    def translate_with_dict(self, text, src, dest):
        """Fallback dictionary translation"""
        key = f'{src}-{dest}'
        translations = self.backup_translations.get(key, {})
        
        text_lower = text.lower().strip()
        
        # Direct match
        if text_lower in translations:
            return translations[text_lower]
        
        # Partial match
        for phrase, translation in translations.items():
            if phrase in text_lower:
                return text_lower.replace(phrase, translation)
        
        # Word-by-word translation
        words = text_lower.split()
        translated_words = []
        
        for word in words:
            translated = translations.get(word, word)
            translated_words.append(translated)
        
        result = ' '.join(translated_words)
        
        # If no translation found, return with note
        if result == text_lower:
            return f"[Translation needed: {text}]"
        
        return result

class MockTranslation:
    """Mock translation object to mimic googletrans interface"""
    def __init__(self, text, src, dest):
        self.text = text
        self.src = src
        self.dest = dest

class VoiceTranslatorApp:
    """Streamlit Voice Translation Application - Working Version"""
    
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
        
        .metric-card {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 1rem;
            border-radius: 10px;
            text-align: center;
        }
        </style>
        """, unsafe_allow_html=True)
    
    def initialize_services(self):
        """Initialize available services"""
        self.services_status = {
            'speech_recognition': SPEECH_RECOGNITION_AVAILABLE,
            'translation': True,  # Always available with our fallback
            'tts': TTS_AVAILABLE
        }
        
        # Initialize translation service
        self.translator = SimpleTranslator()
        
        if SPEECH_RECOGNITION_AVAILABLE:
            try:
                self.recognizer = sr.Recognizer()
                self.microphone = sr.Microphone()
            except Exception as e:
                self.services_status['speech_recognition'] = False
        
        if TTS_AVAILABLE:
            try:
                self.tts_engine = pyttsx3.init()
                self.tts_engine.setProperty('rate', 150)
                self.tts_engine.setProperty('volume', 0.9)
            except Exception as e:
                self.services_status['tts'] = False
    
    def render_header(self):
        """Render application header"""
        st.markdown("""
        <div class="main-header">
            <h1>🗣️ Voice Translator</h1>
            <h3>English ⇄ German • Working Version</h3>
            <p>Reliable translation with multiple backends</p>
        </div>
        """, unsafe_allow_html=True)
    
    def render_sidebar(self):
        """Render sidebar controls"""
        with st.sidebar:
            st.title("🎛️ Controls")
            
            # Service Status
            st.subheader("🔧 Service Status")
            
            services = [
                ("Translation", self.services_status['translation']),
                ("Speech Recognition", self.services_status['speech_recognition']),
                ("Text-to-Speech", self.services_status['tts'])
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
            
            # Clear session
            if st.button("🗑️ Clear Session", use_container_width=True):
                self.clear_session()
    
    def render_main_interface(self):
        """Render main translation interface"""
        # Voice Input Section
        st.subheader("🎙️ Voice Input")
        
        if self.services_status['speech_recognition']:
            col1, col2, col3 = st.columns([1, 2, 1])
            
            with col2:
                if st.button("🎤 Record Voice", use_container_width=True, type="primary"):
                    self.record_and_translate()
        else:
            st.warning("⚠️ Voice recording not available. Install SpeechRecognition: `pip install SpeechRecognition`")
        
        st.divider()
        
        # Text Input Section
        st.subheader("⌨️ Text Input")
        
        source_lang_name = "English" if st.session_state.source_language == 'en' else "German"
        
        text_input = st.text_area(
            f"Type in {source_lang_name}:",
            height=100,
            placeholder=f"Enter text in {source_lang_name}...",
            help="Type your text here and click translate"
        )
        
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            if st.button("🔄 Translate Text", use_container_width=True, type="primary") and text_input.strip():
                self.translate_text(text_input.strip())
        
        # Quick phrase buttons
        st.subheader("⚡ Quick Phrases")
        
        phrases = {
            'en': ['Hello', 'Thank you', 'Excuse me', 'How are you?', 'Where is...?', 'How much?'],
            'de': ['Hallo', 'Danke', 'Entschuldigung', 'Wie geht es dir?', 'Wo ist...?', 'Wie viel?']
        }
        
        current_phrases = phrases[st.session_state.source_language]
        
        cols = st.columns(3)
        for i, phrase in enumerate(current_phrases):
            with cols[i % 3]:
                if st.button(phrase, key=f"phrase_{i}"):
                    self.translate_text(phrase)
    
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
    
    def render_conversation_history(self):
        """Render conversation history"""
        if st.session_state.conversation_history:
            st.subheader("📚 Recent Translations")
            
            # Show last 5 translations
            recent = list(reversed(st.session_state.conversation_history[-5:]))
            
            for i, item in enumerate(recent):
                with st.expander(f"💬 {item['timestamp'].strftime('%H:%M')} - {item['original_text'][:30]}..."):
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        st.write("**Original:**")
                        st.write(item['original_text'])
                    
                    with col2:
                        st.write("**Translation:**")
                        st.write(item['translated_text'])
    
    def record_and_translate(self):
        """Record voice and translate"""
        if not self.services_status['speech_recognition']:
            st.error("❌ Speech recognition not available")
            return
        
        try:
            with st.status("🎤 Recording...", expanded=True) as status:
                st.write("Listening for speech...")
                
                with self.microphone as source:
                    self.recognizer.adjust_for_ambient_noise(source, duration=1)
                    st.write("Please speak clearly...")
                    
                    audio = self.recognizer.listen(source, timeout=8, phrase_time_limit=6)
                
                st.write("Processing speech...")
                
                # Convert speech to text
                lang_code = 'en-US' if st.session_state.source_language == 'en' else 'de-DE'
                text = self.recognizer.recognize_google(audio, language=lang_code)
                
                st.write(f"Detected: {text}")
                
                if text.strip():
                    self.translate_text(text.strip())
                    status.update(label="✅ Recording complete!", state="complete")
                else:
                    status.update(label="⚠️ No speech detected", state="error")
                    
        except sr.WaitTimeoutError:
            st.warning("⚠️ No speech detected")
        except sr.UnknownValueError:
            st.warning("⚠️ Could not understand the audio")
        except Exception as e:
            st.error(f"❌ Recording failed: {e}")
    
    def translate_text(self, text):
        """Translate text between languages"""
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
    
    def speak_text(self, text, language):
        """Convert text to speech"""
        if not self.services_status['tts']:
            st.warning("⚠️ Text-to-speech not available")
            return
        
        try:
            # Simple TTS without voice selection complications
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
            
        except Exception as e:
            st.error(f"❌ Text-to-speech failed: {e}")
    
    def save_to_history(self, translation):
        """Save translation to conversation history"""
        st.session_state.conversation_history.append(translation)
        
        # Limit history size
        if len(st.session_state.conversation_history) > 50:
            st.session_state.conversation_history = st.session_state.conversation_history[-50:]
    
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
    
    def run(self):
        """Main application runner"""
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
            st.error(f"❌ Application error: {e}")

def main():
    """Application entry point"""
    try:
        app = VoiceTranslatorApp()
        app.run()
        
    except Exception as e:
        st.error(f"❌ Failed to start application: {e}")

if __name__ == "__main__":
    main()
