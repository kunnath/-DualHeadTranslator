#!/usr/bin/env python3
"""
Streamlit Voice Translator - Bulletproof Version
Works with minimal dependencies and handles all import errors gracefully
"""

import streamlit as st
import sys
import os
import logging
from datetime import datetime
import requests
import time

# Set page config first (before any other streamlit calls)
st.set_page_config(
    page_title="🗣️ Voice Translator | English ⇄ German",
    page_icon="🗣️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Check for optional imports with graceful fallbacks
try:
    from deep_translator import GoogleTranslator
    DEEP_TRANSLATOR_AVAILABLE = True
    st.success("✅ Deep Translator loaded successfully")
except ImportError:
    DEEP_TRANSLATOR_AVAILABLE = False
    st.warning("⚠️ Deep Translator not available. Install with: `pip install deep-translator`")

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

# Simple fallback translator using multiple free APIs
class FallbackTranslator:
    """Reliable translation service with multiple fallback methods"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        # Comprehensive backup dictionary
        self.backup_translations = {
            'en-de': {
                # Basic greetings
                'hello': 'hallo',
                'hi': 'hallo', 
                'good morning': 'guten morgen',
                'good afternoon': 'guten tag',
                'good evening': 'guten abend',
                'good night': 'gute nacht',
                'goodbye': 'auf wiedersehen',
                'bye': 'tschüss',
                'see you later': 'bis später',
                
                # Politeness
                'please': 'bitte',
                'thank you': 'danke',
                'thanks': 'danke',
                'thank you very much': 'vielen dank',
                'you are welcome': 'bitte schön',
                'excuse me': 'entschuldigung',
                'sorry': 'entschuldigung',
                'pardon': 'verzeihung',
                
                # Questions
                'how are you': 'wie geht es dir',
                'what is your name': 'wie heißt du',
                'where are you from': 'woher kommst du',
                'how old are you': 'wie alt bist du',
                'what time is it': 'wie spät ist es',
                'where is': 'wo ist',
                'how much': 'wie viel',
                'how many': 'wie viele',
                'what': 'was',
                'when': 'wann',
                'where': 'wo',
                'why': 'warum',
                'how': 'wie',
                'who': 'wer',
                
                # Basic responses
                'yes': 'ja',
                'no': 'nein',
                'maybe': 'vielleicht',
                'i do not know': 'ich weiß nicht',
                'i understand': 'ich verstehe',
                'i do not understand': 'ich verstehe nicht',
                'i speak english': 'ich spreche englisch',
                'do you speak english': 'sprechen sie englisch',
                'i love you': 'ich liebe dich',
                'i like it': 'es gefällt mir',
                
                # Emergency and help
                'help': 'hilfe',
                'help me': 'hilf mir',
                'call the police': 'rufen sie die polizei',
                'call a doctor': 'rufen sie einen arzt',
                'emergency': 'notfall',
                'hospital': 'krankenhaus',
                'police': 'polizei',
                'fire department': 'feuerwehr',
                
                # Travel and directions
                'where is the bathroom': 'wo ist die toilette',
                'where is the train station': 'wo ist der bahnhof',
                'where is the airport': 'wo ist der flughafen',
                'where is the hotel': 'wo ist das hotel',
                'where is the restaurant': 'wo ist das restaurant',
                'left': 'links',
                'right': 'rechts',
                'straight': 'geradeaus',
                'near': 'nah',
                'far': 'weit',
                
                # Food and drink
                'water': 'wasser',
                'food': 'essen',
                'bread': 'brot',
                'meat': 'fleisch',
                'fish': 'fisch',
                'vegetables': 'gemüse',
                'fruit': 'obst',
                'coffee': 'kaffee',
                'tea': 'tee',
                'beer': 'bier',
                'wine': 'wein',
                'milk': 'milch',
                'sugar': 'zucker',
                'salt': 'salz',
                
                # Numbers
                'one': 'eins', 'two': 'zwei', 'three': 'drei', 'four': 'vier', 'five': 'fünf',
                'six': 'sechs', 'seven': 'sieben', 'eight': 'acht', 'nine': 'neun', 'ten': 'zehn',
                'eleven': 'elf', 'twelve': 'zwölf', 'twenty': 'zwanzig', 'thirty': 'dreißig',
                'forty': 'vierzig', 'fifty': 'fünfzig', 'hundred': 'hundert', 'thousand': 'tausend',
                
                # Common verbs
                'go': 'gehen', 'come': 'kommen', 'see': 'sehen', 'hear': 'hören', 'speak': 'sprechen',
                'eat': 'essen', 'drink': 'trinken', 'sleep': 'schlafen', 'work': 'arbeiten',
                'study': 'studieren', 'play': 'spielen', 'run': 'laufen', 'walk': 'gehen',
                'buy': 'kaufen', 'sell': 'verkaufen', 'give': 'geben', 'take': 'nehmen',
                
                # Time
                'today': 'heute', 'tomorrow': 'morgen', 'yesterday': 'gestern',
                'now': 'jetzt', 'later': 'später', 'early': 'früh', 'late': 'spät',
                'morning': 'morgen', 'afternoon': 'nachmittag', 'evening': 'abend', 'night': 'nacht',
                'monday': 'montag', 'tuesday': 'dienstag', 'wednesday': 'mittwoch',
                'thursday': 'donnerstag', 'friday': 'freitag', 'saturday': 'samstag', 'sunday': 'sonntag'
            }
        }
        
        # Create reverse dictionary for de-en
        self.backup_translations['de-en'] = {v: k for k, v in self.backup_translations['en-de'].items()}
    
    def translate(self, text, src='en', dest='de'):
        """Main translation method with multiple fallbacks"""
        if not text or not text.strip():
            return MockTranslation("", src, dest)
        
        # Try method 1: Deep Translator (if available)
        if DEEP_TRANSLATOR_AVAILABLE:
            try:
                result = self.translate_with_deep_translator(text, src, dest)
                if result and result != text:
                    return MockTranslation(result, src, dest)
            except Exception as e:
                st.warning(f"Deep Translator failed: {e}")
        
        # Try method 2: MyMemory API
        try:
            result = self.translate_with_mymemory(text, src, dest)
            if result and result != text:
                return MockTranslation(result, src, dest)
        except Exception as e:
            st.warning(f"MyMemory API failed: {e}")
        
        # Try method 3: LibreTranslate
        try:
            result = self.translate_with_libretranslate(text, src, dest)
            if result and result != text:
                return MockTranslation(result, src, dest)
        except Exception as e:
            st.info("LibreTranslate not available, using dictionary fallback")
        
        # Fallback method 4: Dictionary lookup
        result = self.translate_with_dictionary(text, src, dest)
        return MockTranslation(result, src, dest)
    
    def translate_with_deep_translator(self, text, src, dest):
        """Use deep-translator library"""
        if not DEEP_TRANSLATOR_AVAILABLE:
            return None
        
        translator = GoogleTranslator(source=src, target=dest)
        return translator.translate(text)
    
    def translate_with_mymemory(self, text, src, dest):
        """Use MyMemory free translation API"""
        try:
            url = "https://api.mymemory.translated.net/get"
            params = {
                'q': text,
                'langpair': f'{src}|{dest}'
            }
            
            response = self.session.get(url, params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get('responseStatus') == 200:
                    translated = data['responseData']['translatedText']
                    # Filter out common API artifacts
                    if not any(phrase in translated.lower() for phrase in ['hello', 'quota', 'limit']):
                        return translated
        except Exception:
            pass
        return None
    
    def translate_with_libretranslate(self, text, src, dest):
        """Use LibreTranslate free API"""
        try:
            url = "https://libretranslate.de/translate"
            data = {
                'q': text,
                'source': src,
                'target': dest,
                'format': 'text'
            }
            
            response = self.session.post(url, data=data, timeout=5)
            if response.status_code == 200:
                result = response.json()
                if 'translatedText' in result:
                    return result['translatedText']
        except Exception:
            pass
        return None
    
    def translate_with_dictionary(self, text, src, dest):
        """Fallback dictionary translation"""
        key = f'{src}-{dest}'
        translations = self.backup_translations.get(key, {})
        
        text_lower = text.lower().strip()
        
        # Direct phrase match
        if text_lower in translations:
            return translations[text_lower]
        
        # Check for partial matches
        best_match = ""
        for phrase, translation in translations.items():
            if phrase in text_lower:
                if len(phrase) > len(best_match):
                    best_match = phrase
                    text_lower = text_lower.replace(phrase, translation)
        
        if best_match:
            return text_lower
        
        # Word-by-word translation
        words = text_lower.split()
        translated_words = []
        
        for word in words:
            # Remove punctuation for lookup
            clean_word = word.strip('.,!?;:"()[]')
            if clean_word in translations:
                translated_words.append(translations[clean_word])
            else:
                translated_words.append(word)
        
        result = ' '.join(translated_words)
        
        # If no translation found, return with note
        if result == text_lower:
            return f"[Need translation: {text}]"
        
        return result

class MockTranslation:
    """Mock translation object"""
    def __init__(self, text, src, dest):
        self.text = text
        self.src = src
        self.dest = dest

class VoiceTranslatorApp:
    """Bulletproof Streamlit Voice Translation Application"""
    
    def __init__(self):
        self.setup_session_state()
        self.setup_styles()
        self.initialize_services()
        
    def setup_session_state(self):
        """Initialize session state"""
        defaults = {
            'conversation_history': [],
            'source_language': 'en',
            'target_language': 'de',
            'current_translation': None,
            'session_stats': {
                'translations_count': 0,
                'session_start': datetime.now(),
                'total_words': 0
            }
        }
        
        for key, value in defaults.items():
            if key not in st.session_state:
                st.session_state[key] = value
    
    def setup_styles(self):
        """Custom CSS styles"""
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
        
        .service-status {
            padding: 0.5rem;
            margin: 0.2rem 0;
            border-radius: 5px;
            font-size: 0.9em;
        }
        
        .service-working { background-color: #d4edda; color: #155724; }
        .service-missing { background-color: #f8d7da; color: #721c24; }
        
        .quick-phrase {
            margin: 0.2rem;
            padding: 0.5rem;
            font-size: 0.9em;
        }
        </style>
        """, unsafe_allow_html=True)
    
    def initialize_services(self):
        """Initialize translation and speech services"""
        self.services_status = {
            'translation': True,  # Always available
            'speech_recognition': SPEECH_RECOGNITION_AVAILABLE,
            'tts': TTS_AVAILABLE,
            'deep_translator': DEEP_TRANSLATOR_AVAILABLE
        }
        
        # Initialize translator
        self.translator = FallbackTranslator()
        
        # Initialize speech recognition if available
        if SPEECH_RECOGNITION_AVAILABLE:
            try:
                self.recognizer = sr.Recognizer()
                self.microphone = sr.Microphone()
            except Exception:
                self.services_status['speech_recognition'] = False
        
        # Initialize TTS if available
        if TTS_AVAILABLE:
            try:
                self.tts_engine = pyttsx3.init()
                self.tts_engine.setProperty('rate', 150)
                self.tts_engine.setProperty('volume', 0.9)
            except Exception:
                self.services_status['tts'] = False
    
    def render_header(self):
        """Application header"""
        st.markdown("""
        <div class="main-header">
            <h1>🗣️ Voice Translator</h1>
            <h3>English ⇄ German • Bulletproof Edition</h3>
            <p>Works with minimal dependencies</p>
        </div>
        """, unsafe_allow_html=True)
    
    def render_sidebar(self):
        """Sidebar with controls"""
        with st.sidebar:
            st.title("🎛️ Controls")
            
            # Service status
            st.subheader("🔧 Service Status")
            
            services = [
                ("Translation", self.services_status['translation'], "Core functionality"),
                ("Speech Recognition", self.services_status['speech_recognition'], "Voice input"),
                ("Text-to-Speech", self.services_status['tts'], "Audio output"),
                ("Deep Translator", self.services_status['deep_translator'], "Enhanced translation")
            ]
            
            for name, status, description in services:
                status_class = "service-working" if status else "service-missing"
                status_icon = "✅" if status else "❌"
                st.markdown(f"""
                <div class="service-status {status_class}">
                    {status_icon} <strong>{name}</strong><br>
                    <small>{description}</small>
                </div>
                """, unsafe_allow_html=True)
            
            # Installation help
            if not all(self.services_status.values()):
                with st.expander("📦 Install Missing Features"):
                    if not self.services_status['deep_translator']:
                        st.code("pip install deep-translator")
                    if not self.services_status['speech_recognition']:
                        st.code("pip install SpeechRecognition")
                    if not self.services_status['tts']:
                        st.code("pip install pyttsx3")
            
            st.divider()
            
            # Language selection
            st.subheader("🌍 Language")
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("🇺🇸→🇩🇪", use_container_width=True):
                    st.session_state.source_language = 'en'
                    st.session_state.target_language = 'de'
                    st.rerun()
                    
            with col2:
                if st.button("🇩🇪→🇺🇸", use_container_width=True):
                    st.session_state.source_language = 'de'
                    st.session_state.target_language = 'en'
                    st.rerun()
            
            # Current language display
            source = "English 🇺🇸" if st.session_state.source_language == 'en' else "German 🇩🇪"
            target = "German 🇩🇪" if st.session_state.target_language == 'de' else "English 🇺🇸"
            st.info(f"**{source}** → **{target}**")
            
            st.divider()
            
            # Statistics
            st.subheader("📊 Session Stats")
            stats = st.session_state.session_stats
            
            col1, col2 = st.columns(2)
            with col1:
                st.metric("Translations", stats['translations_count'])
            with col2:
                st.metric("Words", stats['total_words'])
            
            if st.button("🗑️ Clear Session", use_container_width=True):
                self.clear_session()
    
    def render_main_interface(self):
        """Main translation interface"""
        # Voice input section
        if self.services_status['speech_recognition']:
            st.subheader("🎙️ Voice Input")
            col1, col2, col3 = st.columns([1, 2, 1])
            with col2:
                if st.button("🎤 Record Voice", use_container_width=True, type="primary"):
                    self.record_and_translate()
        else:
            st.info("🎙️ Voice input available after installing: `pip install SpeechRecognition`")
        
        # Text input section
        st.subheader("⌨️ Text Input")
        
        source_lang = "English" if st.session_state.source_language == 'en' else "German"
        
        text_input = st.text_area(
            f"Type in {source_lang}:",
            height=100,
            placeholder=f"Enter text in {source_lang}...",
            key="text_input"
        )
        
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            if st.button("🔄 Translate", use_container_width=True, type="primary"):
                if text_input.strip():
                    self.translate_text(text_input.strip())
                else:
                    st.warning("Please enter some text to translate")
        
        # Quick phrases
        st.subheader("⚡ Quick Phrases")
        self.render_quick_phrases()
    
    def render_quick_phrases(self):
        """Quick phrase buttons"""
        phrases = {
            'en': [
                'Hello', 'Thank you', 'Please', 'Excuse me', 
                'How are you?', 'Where is the bathroom?', 'How much?',
                'I need help', 'Do you speak English?', 'I don\'t understand'
            ],
            'de': [
                'Hallo', 'Danke', 'Bitte', 'Entschuldigung',
                'Wie geht es dir?', 'Wo ist die Toilette?', 'Wie viel?',
                'Ich brauche Hilfe', 'Sprechen Sie Englisch?', 'Ich verstehe nicht'
            ]
        }
        
        current_phrases = phrases[st.session_state.source_language]
        
        # Create 2 columns for phrases
        col1, col2 = st.columns(2)
        
        for i, phrase in enumerate(current_phrases):
            target_col = col1 if i % 2 == 0 else col2
            with target_col:
                if st.button(phrase, key=f"phrase_{i}", use_container_width=True):
                    self.translate_text(phrase)
    
    def render_translation_results(self):
        """Display translation results"""
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
                
                if self.services_status['tts']:
                    if st.button("🔊 Play Original", key="play_orig"):
                        self.speak_text(translation['original_text'])
            
            with col2:
                st.markdown(f"""
                <div class="translation-box">
                    <h4>🔄 Translation ({self.get_language_name(translation['target_lang'])})</h4>
                    <p style="font-size: 1.1em; color: #2b6cb0;">{translation['translated_text']}</p>
                </div>
                """, unsafe_allow_html=True)
                
                if self.services_status['tts']:
                    if st.button("🔊 Play Translation", key="play_trans"):
                        self.speak_text(translation['translated_text'])
    
    def render_conversation_history(self):
        """Display conversation history"""
        if st.session_state.conversation_history:
            st.subheader("📚 Recent Translations")
            
            recent = list(reversed(st.session_state.conversation_history[-5:]))
            
            for i, item in enumerate(recent):
                time_str = item['timestamp'].strftime('%H:%M')
                preview = item['original_text'][:40] + "..." if len(item['original_text']) > 40 else item['original_text']
                
                with st.expander(f"💬 {time_str} - {preview}"):
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
                st.write("Adjusting for ambient noise...")
                
                with self.microphone as source:
                    self.recognizer.adjust_for_ambient_noise(source, duration=1)
                    st.write("Listening... Please speak clearly!")
                    
                    # Record audio
                    audio = self.recognizer.listen(source, timeout=8, phrase_time_limit=6)
                
                st.write("Processing speech...")
                
                # Convert to text
                lang_code = 'en-US' if st.session_state.source_language == 'en' else 'de-DE'
                text = self.recognizer.recognize_google(audio, language=lang_code)
                
                st.write(f"You said: {text}")
                
                if text.strip():
                    self.translate_text(text.strip())
                    status.update(label="✅ Complete!", state="complete")
                    st.rerun()
                
        except sr.WaitTimeoutError:
            st.warning("⚠️ No speech detected - please try again")
        except sr.UnknownValueError:
            st.warning("⚠️ Could not understand audio - please speak more clearly")
        except Exception as e:
            st.error(f"❌ Recording error: {e}")
    
    def translate_text(self, text):
        """Translate text"""
        try:
            with st.spinner("🔄 Translating..."):
                # Perform translation
                translation = self.translator.translate(
                    text,
                    src=st.session_state.source_language,
                    dest=st.session_state.target_language
                )
                
                # Create result
                result = {
                    'original_text': text,
                    'translated_text': translation.text,
                    'source_lang': st.session_state.source_language,
                    'target_lang': st.session_state.target_language,
                    'timestamp': datetime.now()
                }
                
                # Store result
                st.session_state.current_translation = result
                
                # Update stats
                self.update_stats(text)
                
                # Save to history
                self.save_to_history(result)
                
                st.success("✅ Translation completed!")
                
                # Auto-play if available
                if self.services_status['tts']:
                    self.speak_text(translation.text)
                
                st.rerun()
                
        except Exception as e:
            st.error(f"❌ Translation failed: {e}")
    
    def speak_text(self, text):
        """Text-to-speech"""
        if not self.services_status['tts']:
            st.info("🔊 Audio playback available after installing: `pip install pyttsx3`")
            return
        
        try:
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
        except Exception as e:
            st.error(f"❌ Speech failed: {e}")
    
    def save_to_history(self, translation):
        """Save to conversation history"""
        # Avoid duplicates
        if translation not in st.session_state.conversation_history:
            st.session_state.conversation_history.append(translation)
            
            # Limit history size
            if len(st.session_state.conversation_history) > 50:
                st.session_state.conversation_history = st.session_state.conversation_history[-50:]
    
    def update_stats(self, text):
        """Update session statistics"""
        st.session_state.session_stats['translations_count'] += 1
        st.session_state.session_stats['total_words'] += len(text.split())
    
    def clear_session(self):
        """Clear session data"""
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
        """Get language name from code"""
        return "English" if code == 'en' else "German"
    
    def run(self):
        """Main application"""
        try:
            self.render_header()
            self.render_sidebar()
            self.render_main_interface()
            self.render_translation_results()
            self.render_conversation_history()
            
            # Footer
            st.markdown("---")
            st.markdown("🗣️ **Voice Translator** | Works with minimal dependencies | Built with ❤️")
            
        except Exception as e:
            st.error(f"❌ Application error: {e}")

def main():
    """Entry point"""
    app = VoiceTranslatorApp()
    app.run()

if __name__ == "__main__":
    main()
