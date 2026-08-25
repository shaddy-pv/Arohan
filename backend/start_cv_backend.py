#!/usr/bin/env python3
"""
AROHAN CV Backend Startup Script
"""

import os
import sys
import subprocess
from pathlib import Path

# Load .env file early so all env vars are available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # Will be handled during requirements check


def check_requirements():
    """Check if required packages are installed"""
    try:
        __import__('cv2')
        __import__('flask')
        __import__('numpy')
        print("✅ All required packages are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing required package: {e}")
        return False


def install_requirements():
    """Install requirements if needed"""
    requirements_file = Path(__file__).parent / "requirements_cv.txt"

    if not requirements_file.exists():
        print("❌ requirements_cv.txt not found")
        return False

    print("📦 Installing requirements...")
    try:
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ])
        print("✅ Requirements installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install requirements: {e}")
        return False


def main():
    print("🚀 AROHAN CV Backend Startup")
    print("=" * 40)

    # Check if requirements are installed
    if not check_requirements():
        print("\n📦 Installing missing requirements...")
        if not install_requirements():
            print("❌ Failed to install requirements. Please install manually:")
            print("   pip install -r requirements_cv.txt")
            sys.exit(1)

    # Set environment variables
    esp32_url = os.getenv('ESP32_CAM_URL', 'http://192.168.1.22')
    print(f"📷 ESP32-CAM URL: {esp32_url}")

    # Import and start the backend
    try:
        from cv_backend import CVBackend

        print("\n🎯 Starting CV Backend...")
        backend = CVBackend()
        backend.run(host='0.0.0.0', port=5000, debug=False)

    except ImportError as e:
        print(f"❌ Failed to import CV backend: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 CV Backend stopped by user")
    except Exception as e:
        print(f"❌ CV Backend error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
