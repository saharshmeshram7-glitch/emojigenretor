const BACKEND_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://127.0.0.1:5000"
    : "https://emojigenretor.onrender.com";

let selectedImageBase64 = "";

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        selectedImageBase64 = e.target.result;
        document.getElementById("image-preview").src = selectedImageBase64;
        document.getElementById("image-preview-container").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    selectedImageBase64 = "";
    document.getElementById("image-upload").value = "";
    document.getElementById("image-preview").src = "";
    document.getElementById("image-preview-container").classList.add("hidden");
}

const prompts = ["happy cat", "angry robot", "cute panda", "cool dog", "fire emoji"];

async function generateEmoji() {
    const promptInput = document.getElementById("prompt");
    const style = document.getElementById("style").value;
    const outputDiv = document.getElementById("output");
    const loading = document.getElementById("loading");

    const prompt = promptInput.value.trim();
    if (!prompt) {
        alert("Enter prompt!");
        return;
    }

    loading.classList.remove("hidden");
    outputDiv.innerHTML = "";

    try {
        const payload = { prompt: prompt };

        // Dono dropdown values (GIF ya GIF emoji) ke liye bulletproof check
        if (style === "GIF" || style === "GIF emoji") {
            payload.is_gif = true;
        } else {
            payload.prompt = `${prompt} ${style}`;
            payload.is_gif = false;
        }

        if (selectedImageBase64) payload.image = selectedImageBase64;

        const response = await fetch(`${BACKEND_URL}/generate-emoji`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        loading.classList.add("hidden");

        if (data.image) {
            const isGif = (style === "GIF" || style === "GIF emoji");
            const mimeType = isGif ? "image/gif" : "image/png";
            const fileExt = isGif ? "gif" : "png";

            outputDiv.innerHTML = `
                <img src="data:${mimeType};base64,${data.image}" />
                <br><br>
                <button onclick="downloadImage('${data.image}', '${fileExt}')">Download</button>
            `;
        } else {
            outputDiv.innerHTML = `<p style="color:#f87171;">${data.error || "Error occurred"}</p>`;
        }
    } catch (error) {
        loading.classList.add("hidden");
        outputDiv.innerHTML = `<p style="color:#f87171;">Something went wrong. Backend waking up, please retry in 1 minute!</p>`;
    }
}

function downloadImage(base64, ext = "png") {
    const link = document.createElement("a");
    const mimeType = ext === "gif" ? "image/gif" : "image/png";
    link.href = `data:${mimeType};base64,` + base64;
    link.download = `ai_emoji.${ext}`;
    link.click();
}