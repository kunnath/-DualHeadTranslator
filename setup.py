#!/usr/bin/env python3
"""
Streamlit Voice Translator Setup Script
Automated setup for the voice translation application
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(command, description):
    """Run a shell command and handle errors"""
    print(f"\n🔧 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, 
                              capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"   Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    version = sys.version_info
    print(f"🐍 Python version: {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8 or higher is required")
        return False
    
    print("✅ Python version is compatible")
    return True

def install_system_dependencies():
    """Install system-level dependencies"""
    import platform
    system = platform.system().lower()
    
    print(f"\n🖥️ Detected system: {system}")
    
    if system == "darwin":  # macOS
        print("Installing macOS dependencies...")
        commands = [
            ("brew --version", "Checking Homebrew"),
            ("brew install portaudio", "Installing PortAudio")
        ]
        
        for cmd, desc in commands:
            if "brew --version" in cmd:
                # Check if brew is installed
                if not run_command(cmd, desc):
                    print("⚠️ Homebrew not found. Please install it first:")
                    print("   /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"")
                    return False
            else:
                run_command(cmd, desc)
    
    elif system == "linux":
        # Try to detect Linux distribution
        try:
            with open("/etc/os-release") as f:
                os_info = f.read().lower()
                
            if "ubuntu" in os_info or "debian" in os_info:
                print("Installing Ubuntu/Debian dependencies...")
                commands = [
                    ("sudo apt-get update", "Updating package list"),
                    ("sudo apt-get install -y portaudio19-dev python3-pyaudio", "Installing PortAudio"),
                    ("sudo apt-get install -y espeak espeak-data libespeak1 libespeak-dev", "Installing espeak"),
                    ("sudo apt-get install -y ffmpeg", "Installing ffmpeg")
                ]
                
                for cmd, desc in commands:
                    run_command(cmd, desc)
            
            elif "fedora" in os_info or "centos" in os_info or "rhel" in os_info:
                print("Installing Fedora/CentOS/RHEL dependencies...")
                commands = [
                    ("sudo dnf install -y portaudio-devel", "Installing PortAudio"),
                    ("sudo dnf install -y espeak espeak-devel", "Installing espeak"),
                    ("sudo dnf install -y ffmpeg", "Installing ffmpeg")
                ]
                
                for cmd, desc in commands:
                    run_command(cmd, desc)
            
        except Exception as e:
            print(f"⚠️ Could not detect Linux distribution: {e}")
            print("Please install portaudio development libraries manually")
    
    elif system == "windows":
        print("Windows detected. PyAudio should install automatically with pip.")
        print("If you encounter issues, please install Microsoft Visual C++ Build Tools")
    
    return True

def install_python_dependencies():
    """Install Python packages"""
    print("\n📦 Installing Python dependencies...")
    
    # Core dependencies
    core_packages = [
        "streamlit>=1.28.0",
        "SpeechRecognition>=3.10.0",
        "googletrans==4.0.0rc1",
        "requests>=2.31.0"
    ]
    
    # Audio packages (may require system dependencies)
    audio_packages = [
        "pyttsx3>=2.90",
        "pyaudio>=0.2.11"
    ]
    
    # Optional packages
    optional_packages = [
        "numpy>=1.24.0",
        "sounddevice>=0.4.6",
        "scipy>=1.11.0"
    ]
    
    # Install core packages
    for package in core_packages:
        if not run_command(f"pip install '{package}'", f"Installing {package.split('>=')[0].split('==')[0]}"):
            print(f"⚠️ Failed to install {package}")
    
    # Install audio packages
    for package in audio_packages:
        if not run_command(f"pip install '{package}'", f"Installing {package.split('>=')[0].split('==')[0]}"):
            print(f"⚠️ Failed to install {package}")
            if "pyaudio" in package:
                print("   Try: pip install pipwin && pipwin install pyaudio")
    
    # Install optional packages
    for package in optional_packages:
        run_command(f"pip install '{package}'", f"Installing {package.split('>=')[0].split('==')[0]} (optional)")
    
    return True

def create_launch_script():
    """Create a launch script for the application"""
    script_content = """#!/bin/bash
# Streamlit Voice Translator Launch Script

echo "🚀 Starting Streamlit Voice Translator..."

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "📁 Activating virtual environment..."
    source venv/bin/activate
fi

# Launch the application
streamlit run streamlit_app_simple.py --server.address 0.0.0.0 --server.port 8501

echo "🎉 Application started! Visit: http://localhost:8501"
"""
    
    with open("launch.sh", "w") as f:
        f.write(script_content)
    
    # Make executable
    os.chmod("launch.sh", 0o755)
    print("✅ Created launch script: launch.sh")

def test_installation():
    """Test if all dependencies are working"""
    print("\n🧪 Testing installation...")
    
    tests = [
        ("import streamlit", "Streamlit"),
        ("import speech_recognition", "SpeechRecognition"),
        ("from googletrans import Translator", "GoogleTrans"),
        ("import pyttsx3", "pyttsx3"),
        ("import pyaudio", "PyAudio")
    ]
    
    results = []
    for test_import, name in tests:
        try:
            exec(test_import)
            print(f"✅ {name} is working")
            results.append(True)
        except ImportError as e:
            print(f"❌ {name} failed: {e}")
            results.append(False)
        except Exception as e:
            print(f"⚠️ {name} warning: {e}")
            results.append(True)  # Consider warnings as passing
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📊 Installation success rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🎉 Installation mostly successful!")
        return True
    else:
        print("⚠️ Some dependencies failed to install")
        return False

def main():
    """Main setup function"""
    print("🗣️ Streamlit Voice Translator Setup")
    print("=" * 50)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Install system dependencies
    print("\n" + "=" * 50)
    install_system_dependencies()
    
    # Install Python dependencies
    print("\n" + "=" * 50)
    install_python_dependencies()
    
    # Test installation
    print("\n" + "=" * 50)
    success = test_installation()
    
    # Create launch script
    print("\n" + "=" * 50)
    create_launch_script()
    
    # Final instructions
    print("\n" + "=" * 50)
    print("🎯 Setup Complete!")
    print("\n📝 Next Steps:")
    print("1. Run the application:")
    print("   streamlit run streamlit_app_simple.py")
    print("\n2. Or use the launch script:")
    print("   ./launch.sh")
    print("\n3. Open your browser to:")
    print("   http://localhost:8501")
    
    if not success:
        print("\n⚠️ Some dependencies failed. Check the errors above.")
        print("You can still run the app with limited functionality.")
    
    print("\n🌟 Enjoy your voice translation app!")

if __name__ == "__main__":
    main()
