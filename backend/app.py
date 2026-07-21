# -*- coding: utf-8 -*-
import sys
import os
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import base64
from io import BytesIO
from PIL import Image
import random
import time
import urllib.parse

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,HEAD,POST,OPTIONS"
    return response

@app.errorhandler(Exception)
def handle_exception(e):
    print(f"[ERROR] Global exception handler caught: {e}")
    response = jsonify({"error": str(e) if str(e) else "Internal Server Error"})
    response.status_code = 500
    return response

@app.route("/")
def home():
    return "Emoji API Working!"

def fetch_image_from_pollinations(prompt_text, seed):
    """
    Uses Pollinations GET endpoint to generate images without an API key.
    Includes fallback and shortened external timeouts to avoid worker timeouts.
    """
    print(f"[DEBUG] Sending to API (GET): Prompt: {prompt_text[:100]}... Seed: {seed}")

    encoded_prompt = urllib.parse.quote(prompt_text, safe='')
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    models = ["", "turbo"]

    session = requests.Session()
    retry_strategy = Retry(
        total=1,
        connect=1,
        read=1,
        status=1,
        allowed_methods=["GET"],
        status_forcelist=[429, 500, 502, 503, 504],
        backoff_factor=0.5,
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)

    timeout = (4, 10)
    for attempt in range(1, 3):
        for m in models:
            model_query = f"&model={m}" if m else ""
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?seed={seed}&nologo=true{model_query}"
            try:
                print(f"[DEBUG] Attempt {attempt}/2 model='{m}'...")
                response = session.get(url, timeout=timeout, headers=headers)

                if response.status_code == 200:
                    content_type = response.headers.get("Content-Type", "")
                    if "image" in content_type and len(response.content) > 1000:
                        return response.content
                    print(f"[DEBUG] WARNING: Got 200 but not valid image. Size={len(response.content)}")
                elif response.status_code == 429:
                    print(f"[DEBUG] Rate limited (429). Retrying after short delay...")
                else:
                    print(f"[DEBUG] Status {response.status_code}")
            except requests.exceptions.RequestException as e:
                print(f"[DEBUG] Request error: {e}")
            time.sleep(0.5)
        time.sleep(1)

    return None

def generate_animated_gif_from_image(img_bytes):
    """
    Generates a smooth 6-frame floating/bouncing animated GIF from a base AI emoji image.
    """
    base = Image.open(BytesIO(img_bytes)).convert("RGBA")
    base = base.resize((512, 512), Image.LANCZOS)
    w, h = base.size
    
    frames = []
    anim_params = [
        (0, 1.0),
        (-6, 1.03),
        (-14, 1.06),
        (-18, 1.07),
        (-10, 1.04),
        (-2, 1.01)
    ]
    
    for dy, scale in anim_params:
        nw, nh = int(w * scale), int(h * scale)
        scaled = base.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (w, h), (255, 255, 255, 0))
        x = (w - nw) // 2
        y = (h - nh) // 2 + dy
        canvas.paste(scaled, (x, y), scaled)
        p_frame = canvas.convert("P", palette=Image.ADAPTIVE)
        frames.append(p_frame)
        
    buffer = BytesIO()
    frames[0].save(buffer, format="GIF", save_all=True, append_images=frames[1:], duration=130, loop=0)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")

@app.route("/generate-emoji", methods=["POST"])
def generate_emoji():
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400

        prompt = data.get("prompt", "").strip()
        style = data.get("style", "3d emoji").strip()
        is_gif = bool(data.get("is_gif", False))

        if not prompt:
            return jsonify({"error": "Prompt required"}), 400

        safe_prompt_text = prompt.strip()
        if not safe_prompt_text:
            safe_prompt_text = "cute emoji"

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
        seed = random.randint(1, 999999)

        img_bytes = fetch_image_from_pollinations(full_prompt_text, seed)
        if not img_bytes:
            return jsonify({"error": "AI Server busy, please try again in a few seconds!"}), 500

        if is_gif:
            img_str = generate_animated_gif_from_image(img_bytes)
            return jsonify({"image": img_str})
        else:
            img = Image.open(BytesIO(img_bytes)).convert("RGBA")
            img = img.resize((512, 512), Image.LANCZOS)
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