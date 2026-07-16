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
import time
from urllib.parse import quote

app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    return "Emoji API Working!"

def fetch_image(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; EmojiGenerator/1.0)",
        "Accept": "image/*, */*"
    }
    for i in range(5):
        try:
            response = requests.get(url, timeout=45, headers=headers)
            if response.status_code == 200:
                content_type = response.headers.get("Content-Type", "")
                if "image" in content_type and len(response.content) > 1000:
                    return response
                else:
                    print(f"Attempt {i+1}: Got non-image or empty response.")
            else:
                print(f"Attempt {i+1}: Status {response.status_code}")
        except Exception as e:
            print(f"Attempt {i+1} error: {e}") # Bracket fixed here!
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
        is_gif = data.get("is_gif", False)

        if not prompt:
            return jsonify({"error": "Prompt required"}), 400

        seed = random.randint(1, 999999)
        safe_prompt = prompt.encode('ascii', 'ignore').decode('ascii').strip()
        if not safe_prompt:
            safe_prompt = "cute emoji"

        uploaded_url = None
        if image_b64:
            try:
                if "," in image_b64:
                    image_b64 = image_b64.split(",")[1]
                image_bytes = base64.b64decode(image_b64)
                files = {'file': ('image.png', image_bytes, 'image/png')}
                upload_res = requests.post("https://tmpfiles.org/api/v1/upload", files=files, timeout=20)
                if upload_res.status_code == 200:
                    res_json = upload_res.json()
                    if res_json.get("status") == "success":
                        raw_url = res_json["data"]["url"]
                        uploaded_url = raw_url.replace("tmpfiles.org/", "tmpfiles.org/dl/")
            except Exception as upload_err:
                print(f"Image upload failed: {upload_err}")

        clean_prompt = quote(f"{safe_prompt}, standard 3D Apple emoji style, highly detailed classic emoji, clean, glossy, isolated on plain white background")
        
        # GIF Mode
        if is_gif:
            frames = []
            for i in range(3):
                frame_seed = random.randint(1, 999999)
                if uploaded_url:
                    url = f"https://image.pollinations.ai/prompt/{clean_prompt}?width=512&height=512&seed={frame_seed}&model=kontext&nologo=true&nofeed=true&image={quote(uploaded_url)}"
                else:
                    url = f"https://image.pollinations.ai/prompt/{clean_prompt}?width=512&height=512&seed={frame_seed}&model=flux&nologo=true&nofeed=true"
                
                response = fetch_image(url)
                if response:
                    img = Image.open(BytesIO(response.content)).convert("RGBA")
                    frames.append(img)
                time.sleep(0.3)

            if not frames:
                return jsonify({"error": "AI Server busy, no frames generated"}), 500

            buffer = BytesIO()
            frames[0].save(buffer, format="GIF", save_all=True, append_images=frames[1:], duration=300, loop=0)
            img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return jsonify({"image": img_str})

        # Static Image Mode
        else:
            if uploaded_url:
                url = f"https://image.pollinations.ai/prompt/{clean_prompt}?width=512&height=512&seed={seed}&model=kontext&nologo=true&nofeed=true&image={quote(uploaded_url)}"
            else:
                url = f"https://image.pollinations.ai/prompt/{clean_prompt}?width=512&height=512&seed={seed}&model=flux&nologo=true&nofeed=true"

            response = fetch_image(url)
            if not response:
                return jsonify({"error": "AI Server busy"}), 500

            img = Image.open(BytesIO(response.content)).convert("RGBA")
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return jsonify({"image": img_str})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)