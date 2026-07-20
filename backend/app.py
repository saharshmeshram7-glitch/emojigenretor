# -*- coding: utf-8 -*-
import sys
import os
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import base64
from io import BytesIO
from PIL import Image
import random
from urllib.parse import quote

app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    return "Emoji API Working!"

import time
import urllib.parse

def fetch_image_from_pollinations(prompt_text, seed):
    """
    Uses the Pollinations GET endpoint which generates images without an API key.
    Includes retry logic for rate limits (429) or timeouts.
    """
    print(f"[DEBUG] Sending to API (GET):")
    print(f"[DEBUG]   Prompt: {prompt_text[:100]}...")
    print(f"[DEBUG]   Seed: {seed}")
    
    encoded_prompt = urllib.parse.quote(prompt_text)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?seed={seed}&nologo=true&width=512&height=512"
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"[DEBUG]   Attempt {attempt+1}/{max_retries}...")
            response = requests.get(url, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
            print(f"[DEBUG]   Response: Status={response.status_code}, Size={len(response.content)}")
            
            if response.status_code == 200:
                content_type = response.headers.get("Content-Type", "")
                if "image" in content_type and len(response.content) > 1000:
                    return response
                else:
                    print(f"[DEBUG]   WARNING: Got 200 but not an image. Type={content_type}, Size={len(response.content)}")
            elif response.status_code == 429:
                print(f"[DEBUG]   Rate limited (429). Retrying in 3 seconds...")
                time.sleep(3)
            else:
                print(f"[DEBUG]   ERROR: Status {response.status_code}, Body: {response.content[:200].decode(errors='replace')}")
                # Wait briefly on 500s too
                if response.status_code >= 500:
                    time.sleep(2)
        except requests.exceptions.Timeout:
            print("[DEBUG]   ERROR: Request timed out after 60s")
            time.sleep(2)
        except Exception as e:
            print(f"[DEBUG]   ERROR: {e}")
            time.sleep(2)
            
    return None

@app.route("/generate-emoji", methods=["POST"])
def generate_emoji():
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400

        prompt = data.get("prompt", "").strip()
        image_b64 = data.get("image", "")
        style = data.get("style", "3d emoji").strip()
        is_gif = data.get("is_gif", False)

        if not prompt:
            return jsonify({"error": "Prompt required"}), 400

        safe_prompt_text = prompt.encode('ascii', 'ignore').decode('ascii').strip()
        if not safe_prompt_text:
            safe_prompt_text = "cute emoji"

        # Build style-specific prompt based on the selected style
        style_prompts = {
            "3d emoji": "3D emoji style, highly detailed glossy digital art, vibrant colors, smooth shading, isolated on plain white background",
            "cute emoji": "cute kawaii chibi emoji style, adorable big eyes, pastel colors, round soft shapes, isolated on plain white background",
            "pixel emoji": "pixel art emoji style, 16-bit retro game sprite, blocky pixels, nostalgic 8-bit colors, isolated on plain white background",
            "cartoon emoji": "cartoon emoji style, bold outlines, flat vivid colors, exaggerated expressions, comic book style, isolated on plain white background",
            "anime emoji": "anime emoji style, Japanese manga art, detailed anime eyes, cel shaded, vibrant anime colors, isolated on plain white background",
            "GIF": "3D emoji style, expressive animated pose, highly detailed glossy digital art, vibrant colors, isolated on plain white background"
        }

        style_suffix = style_prompts.get(style, style_prompts["3d emoji"])
        full_prompt_text = f"{safe_prompt_text}, {style_suffix}"

        # --- DYNAMIC FAST GIF LOGIC ---
        if is_gif:
            frames = []
            for i in range(2):
                seed = random.randint(1, 999999)
                # Vary the prompt slightly for each frame to create animation effect
                frame_prompt = f"{full_prompt_text}, variation {i+1}"
                res = fetch_image_from_pollinations(frame_prompt, seed)
                if res:
                    frames.append(Image.open(BytesIO(res.content)).convert("RGBA"))

            if not frames:
                return jsonify({"error": "AI Server busy, try again!"}), 500

            buffer = BytesIO()
            if len(frames) == 1:
                frames[0].save(buffer, format="PNG")
            else:
                frames[0].save(buffer, format="GIF", save_all=True, append_images=frames[1:], duration=400, loop=0)
            
            img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return jsonify({"image": img_str})

        # --- STATIC PHOTO LOGIC ---
        else:
            seed = random.randint(1, 999999)
            res = fetch_image_from_pollinations(full_prompt_text, seed)
            if not res:
                return jsonify({"error": "AI Server busy, try again!"}), 500

            img = Image.open(BytesIO(res.content)).convert("RGBA")
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return jsonify({"image": img_str})

    except Exception as e:
        print(f"generate_emoji error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)