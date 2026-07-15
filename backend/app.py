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
    return "Emoji API Working 🚀"


# Helper function
def fetch_image(url):
    for i in range(5):
        try:
            response = requests.get(url, timeout=30)

            if response.status_code == 200:
                return response

        except Exception as e:
            print("Retrying...", e)
            time.sleep(2)

    return None


@app.route("/generate-emoji", methods=["POST"])
def generate_emoji():
    try:
        data = request.get_json()
        prompt = data.get("prompt", "")
        image_b64 = data.get("image", "")

        if not prompt:
            return jsonify({"error": "Prompt required"}), 400

        seed = random.randint(1, 999999)

        uploaded_url = None
        if image_b64:
            try:
                if "," in image_b64:
                    image_b64 = image_b64.split(",")[1]
                image_bytes = base64.b64decode(image_b64)
                
                files = {'file': ('image.png', image_bytes, 'image/png')}
                upload_res = requests.post("https://tmpfiles.org/api/v1/upload", files=files, timeout=15)
                if upload_res.status_code == 200:
                    res_json = upload_res.json()
                    if res_json.get("status") == "success":
                        raw_url = res_json["data"]["url"]
                        uploaded_url = raw_url.replace("tmpfiles.org/", "tmpfiles.org/dl/")
            except Exception as upload_err:
                print("Image upload failed:", upload_err)

        clean_prompt = quote(
            f"{prompt} emoji, flat icon, simple"
        )

        url = (
            f"https://image.pollinations.ai/prompt/"
            f"{clean_prompt}?width=512&height=512&seed={seed}"
        )

        if uploaded_url:
            url += f"&image={quote(uploaded_url)}"

        response = fetch_image(url)

        if not response:
            return jsonify({"error": "⚠️ Server busy, try again"}), 500

        # Check if API returned image
        if "image" not in response.headers.get("Content-Type", ""):
            return jsonify({"error": "Invalid response from API"}), 500

        img = Image.open(BytesIO(response.content)).convert("RGBA")

        buffer = BytesIO()
        img.save(buffer, format="PNG")

        img_str = base64.b64encode(
            buffer.getvalue()
        ).decode()

        return jsonify({"image": img_str})

    except Exception as e:
        import traceback
        print("Error:", e)
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)