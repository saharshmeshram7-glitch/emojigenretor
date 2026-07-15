// Change this to your deployed Render backend URL after deploying your backend service
const BACKEND_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://127.0.0.1:5000"
    : "https://emojigenretor.onrender.com";

let selectedImageBase64 = "";

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
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

const prompts = [
    "happy cat",
    "angry robot",
    "cute panda",
    "laughing alien",
    "cool dog",
    "crying banana",
    "fire emoji",
    "ghost gamer"
];

async function generateEmoji() {

    const promptInput = document.getElementById("prompt");
    const style = document.getElementById("style").value;
    const outputDiv = document.getElementById("output");
    const loading = document.getElementById("loading");
    const history = document.getElementById("history");

    const prompt = promptInput.value.trim();

    if (!prompt) {
        alert("Enter prompt!");
        return;
    }

    loading.classList.remove("hidden");
    const loadingMsg = document.getElementById("loading").querySelector("p");
    loadingMsg.textContent = "Generating Emoji... (First time may take ~60 secs ⏳)";
    outputDiv.innerHTML = "";

    try {

        const payload = {
            prompt: `${prompt} ${style}`
        };
        if (selectedImageBase64) {
            payload.image = selectedImageBase64;
        }

        // 2-minute timeout to handle Render cold start
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const response = await fetch(
            `${BACKEND_URL}/generate-emoji`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            }
        );
        clearTimeout(timeoutId);

        const data = await response.json();

        loading.classList.add("hidden");

        if (data.image) {

            outputDiv.innerHTML = `
                <img src="data:image/png;base64,${data.image}" />

                <br><br>

                <button onclick="downloadImage('${data.image}')">
                    Download
                </button>
            `;

            history.innerHTML += `
                <img 
                    src="data:image/png;base64,${data.image}"
                    class="history-img"
                />
            `;
        }

    } catch (error) {

        loading.classList.add("hidden");

        let message = "Something went wrong. Please try again!";
        if (error.name === "AbortError") {
            message = "⏳ Request timed out. Server cold start le raha hai — thoda wait karke try karo!";
        } else if (!navigator.onLine) {
            message = "📶 No internet connection!";
        }

        outputDiv.innerHTML = `
            <p style="color:#f87171;">${message}</p>
        `;
    }
}

function downloadImage(base64) {

    const link = document.createElement("a");

    link.href = "data:image/png;base64," + base64;

    link.download = "ai_emoji.png";

    link.click();
}

function randomPrompt() {

    const random = prompts[
        Math.floor(Math.random() * prompts.length)
    ];

    document.getElementById("prompt").value = random;
}

document
    .getElementById("prompt")
    .addEventListener("keypress", function(e) {

        if (e.key === "Enter") {
            generateEmoji();
        }
    });

// Register Service Worker
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js")
            .then((reg) => console.log("Service Worker registered!", reg))
            .catch((err) => console.error("Service Worker registration failed:", err));
    });
}

// Handle PWA Installation
let deferredPrompt;
const installBtn = document.getElementById("install-btn");

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
        installBtn.classList.remove("hidden");
    }
});

if (installBtn) {
    installBtn.addEventListener("click", async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            deferredPrompt = null;
            installBtn.classList.add("hidden");
        }
    });
}

window.addEventListener("appinstalled", () => {
    console.log("PWA was installed");
    if (installBtn) {
        installBtn.classList.add("hidden");
    }
});