from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import base64
from io import BytesIO
from PIL import Image

app = Flask(__name__)
CORS(app)   # <-- THIS LINE FIXES EVERYTHING


@app.route("/generate-emoji", methods=["POST"])
def generate_emoji():
    data = request.get_json()
    prompt = data.get("prompt", "")

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    # Enhance prompt for emoji-style image
    emoji_prompt = f"{prompt}, emoji style, flat design, simple, colorful, vector icon"

    # Pollinations free image generation API
    image_url = f"https://image.pollinations.ai/prompt/{emoji_prompt.replace(' ', '+')}"

    response = requests.get(image_url)

    if response.status_code != 200:
        return jsonify({"error": "Image generation failed"}), 500

    # Convert image to Base64
    image = Image.open(BytesIO(response.content)).convert("RGBA")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return jsonify({
        "image": image_base64
    })


if __name__ == "__main__":
    app.run(debug=True)
