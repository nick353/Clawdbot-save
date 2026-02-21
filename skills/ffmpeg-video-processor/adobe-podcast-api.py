#!/usr/bin/env python3
"""
Adobe Podcast API Client
音声ファイルをAdobe Podcast APIで高品質改善
"""

import hashlib
import base64
import requests
import urllib.parse
import uuid
from datetime import datetime
import time
import sys
import os

class AdobePodcastAPI:
    def __init__(self, authorization_token=None):
        """Initialize Adobe Podcast API client."""
        self.checksum = None
        self.uuid4 = str(uuid.uuid4())
        self.time_upload = datetime.now().strftime("%Y-%m-%d-%H:%M:%S")
        self.track_id = f"{str(uuid.uuid4())}"
        self.signed_id = None
        
        # Add Bearer prefix if not present
        if authorization_token and "Bearer " not in authorization_token:
            authorization_token = f"Bearer {authorization_token}"
        
        self.authorization = authorization_token
        self.base_headers = {
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'authorization': self.authorization,
            'origin': 'https://podcast.adobe.com',
            'priority': 'u=1, i',
            'referer': 'https://podcast.adobe.com/',
            'sec-ch-ua': '"Chromium";v="137", "Not/A)Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Linux"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
            'x-api-key': 'phonos-server-prod',
            'x-cookie-settings': 'C0001,C0002,C0003,C0004',
        }

    def _get_base64_md5(self, file_path):
        """Calculate MD5 checksum of file and return file data."""
        with open(file_path, 'rb') as f:
            file_data = f.read()
            md5_digest = hashlib.md5(file_data).digest()
            base64_md5 = base64.b64encode(md5_digest).decode('utf-8')
            self.checksum = base64_md5
            return file_data

    def _make_request(self, method, url, **kwargs):
        """Helper method to make HTTP requests with error handling."""
        try:
            response = requests.request(method, url, verify=True, **kwargs)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Error making {method} request to {url}: {e}", file=sys.stderr)
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response text: {e.response.text}", file=sys.stderr)
            return None

    def get_direct_upload_url(self, file_path, filename="audio.wav"):
        """Get direct upload URL for the file."""
        file_data = self._get_base64_md5(file_path)
        
        # Determine content type
        if filename.endswith('.mp3'):
            content_type = 'audio/mpeg'
        elif filename.endswith('.wav'):
            content_type = 'audio/wav'
        elif filename.endswith('.m4a'):
            content_type = 'audio/mp4'
        else:
            content_type = 'audio/wav'
        
        headers = {**self.base_headers, 'content-type': 'application/json'}
        json_data = {
            'blob': {
                'filename': filename,
                'content_type': content_type,
                'byte_size': len(file_data),
                'checksum': self.checksum,
            },
        }

        response = self._make_request(
            'POST',
            'https://phonos-server-flex.adobe.io/rails/active_storage/direct_uploads',
            headers=headers,
            json=json_data,
        )
        
        if response:
            return response.json()
        return None

    def upload_file(self, file_path, filename="audio.wav"):
        """Upload file to Adobe Podcast."""
        print(f"📤 Uploading {filename}...")
        file_data = self._get_base64_md5(file_path)
        
        # Get direct upload URL
        direct_upload_data = self.get_direct_upload_url(file_path, filename)
        if not direct_upload_data:
            print("❌ Failed to get direct upload URL", file=sys.stderr)
            return None

        self.signed_id = direct_upload_data['signed_id']
        
        # Determine content type
        if filename.endswith('.mp3'):
            content_type = 'audio/mpeg'
        elif filename.endswith('.wav'):
            content_type = 'audio/wav'
        elif filename.endswith('.m4a'):
            content_type = 'audio/mp4'
        else:
            content_type = 'audio/wav'
        
        # Headers for the upload request
        headers = {
            'Content-Length': str(len(file_data)),
            'Content-Md5': self.checksum,
            'Content-Type': content_type,
            'Content-Disposition': f'inline; filename="{urllib.parse.quote(filename)}"; filename*=UTF-8\'\'{urllib.parse.quote(filename)}',
            'Accept': '*/*',
            'Origin': 'https://podcast.adobe.com',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            'Referer': 'https://podcast.adobe.com/',
            'Accept-Encoding': 'gzip, deflate, br',
            'Priority': 'u=1, i',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
        }

        response = self._make_request(
            'PUT',
            direct_upload_data['direct_upload']['url'],
            headers=headers,
            data=file_data
        )
        
        if response:
            print(f"✅ File uploaded successfully (Status: {response.status_code})")
            return response
        return None

    def create_enhance_speech_track(self, filename="audio.wav"):
        """Create enhanced speech track."""
        print("🎙️ Creating enhancement track...")
        headers = {**self.base_headers, 'content-type': 'application/json'}
        json_data = {
            'id': self.track_id,
            'track_name': filename,
            'model_version': 'v1',
            'signed_id': self.signed_id
        }

        response = self._make_request(
            'POST',
            'https://phonos-server-flex.adobe.io/api/v1/enhance_speech_tracks',
            headers=headers,
            json=json_data,
            params={'time': str(int(datetime.now().timestamp() * 1000))}
        )
        
        if response:
            print("✅ Enhancement track created")
            return response.json()
        return None

    def get_enhanced_audio(self):
        """Get enhanced audio URL."""
        headers = {**self.base_headers}
        params = {'time': str(int(datetime.now().timestamp() * 1000))}

        response = self._make_request(
            'GET',
            f'https://phonos-server-flex.adobe.io/api/v1/enhance_speech_tracks/{self.track_id}/enhanced_audio',
            headers=headers,
            params=params,
        )
        
        if response:
            if response.status_code == 200:  # Enhancement is complete
                return response.status_code, response.json()
            elif response.status_code == 204:  # Still processing
                return response.status_code, None
            else:
                return response.status_code, None
        return None, None

    def download_enhanced_audio(self, download_url, output_path):
        """Download enhanced audio file with progress tracking."""
        print(f"⬇️ Downloading enhanced audio to {output_path}...")
        start_time = time.time()
        
        try:
            with requests.get(download_url, stream=True) as r:
                r.raise_for_status()
                total_size = int(r.headers.get('content-length', 0))
                downloaded = 0
                
                with open(output_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            if total_size > 0:
                                percent = int(100 * downloaded / total_size)
                                print(f"\r   Progress: {percent}%", end='', flush=True)
            
            end_time = time.time()
            print(f"\n✅ File downloaded successfully")
            print(f"   Time taken: {end_time - start_time:.2f} seconds")
            return True
        except Exception as e:
            print(f"\n❌ Error downloading file: {e}", file=sys.stderr)
            return False


def enhance_audio(input_file, output_file, authorization_token):
    """
    Main function to enhance audio using Adobe Podcast API.
    
    Args:
        input_file: Path to input audio file (WAV/MP3/M4A)
        output_file: Path where enhanced audio will be saved
        authorization_token: Adobe Podcast authorization token
    
    Returns:
        bool: True if successful, False otherwise
    """
    if not os.path.exists(input_file):
        print(f"❌ Input file not found: {input_file}", file=sys.stderr)
        return False
    
    filename = os.path.basename(input_file)
    api = AdobePodcastAPI(authorization_token)
    
    # Step 1: Upload file
    print("\n🔄 Step 1/3: Uploading audio file...")
    upload_result = api.upload_file(input_file, filename)
    if not upload_result:
        print("❌ File upload failed", file=sys.stderr)
        return False

    # Step 2: Create enhancement track
    print("\n🔄 Step 2/3: Creating enhancement track...")
    enhance_result = api.create_enhance_speech_track(filename)
    if not enhance_result:
        print("❌ Enhancement track creation failed", file=sys.stderr)
        return False

    # Step 3: Wait for enhancement and download
    print("\n🔄 Step 3/3: Waiting for enhancement to complete...")
    max_attempts = 120  # 10 minutes max (5 sec intervals)
    for attempt in range(max_attempts):
        status_code, data = api.get_enhanced_audio()
        
        if status_code == 200 and data and 'url' in data:
            print("\n✅ Enhancement complete!")
            download_url = data['url'].replace("\\u0026", "&")
            if api.download_enhanced_audio(download_url, output_file):
                return True
            break
        elif status_code == 204:
            print(f"\r   Waiting... ({attempt + 1}/{max_attempts})", end='', flush=True)
        else:
            print(f"\n❌ Error checking enhancement status: {status_code}", file=sys.stderr)
            break
            
        time.sleep(5)
    
    print("\n❌ Enhancement process timed out or failed", file=sys.stderr)
    return False


if __name__ == "__main__":
    # CLI usage
    if len(sys.argv) < 3:
        print("Usage: adobe-podcast-api.py <input_audio> <output_audio> [token]")
        print("Example: adobe-podcast-api.py input.wav output.wav")
        print("Token can be passed as 3rd argument or via ADOBE_PODCAST_TOKEN env var")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    token = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('ADOBE_PODCAST_TOKEN')
    
    if not token:
        print("❌ Error: No authorization token provided", file=sys.stderr)
        print("Set ADOBE_PODCAST_TOKEN environment variable or pass as 3rd argument", file=sys.stderr)
        sys.exit(1)
    
    success = enhance_audio(input_file, output_file, token)
    sys.exit(0 if success else 1)
