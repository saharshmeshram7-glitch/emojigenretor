const LOCAL_BACKEND_URL = "http://127.0.0.1:5000";
const REMOTE_BACKEND_URL = "https://emojigenretor.onrender.com"; // actual backend deployment URL
const BACKEND_URL = window.BACKEND_URL || (
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? LOCAL_BACKEND_URL
        : REMOTE_BACKEND_URL
);

// --- SPA Routing (Tab Switching) ---
function switchTab(tabId) {
    // Hide all sections
    document.querySelectorAll('.app-section').forEach(section => {
        section.classList.add('hidden');
        section.classList.remove('active');
    });
    
    // Deactivate all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(`${tabId}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
    }

    // Activate corresponding nav button
    const targetBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => btn.getAttribute('onclick').includes(tabId));
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    // Specific logic per tab
    if (tabId === 'history') {
        renderHistoryGrid();
    } else if (tabId === 'profile') {
        renderProfileStats();
    }
}


// --- Toast Notifications ---
function showToast(message, type = 'success') {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3400); // Wait for animation to finish completely
}


// --- Emoji Generation ---
function randomPrompt() {
    const ideas = [
        "cyberpunk cat with neon glowing glasses",
        "happy ninja avocado holding a sword",
        "cute gaming teddy bear wearing red headphones",
        "funny angry broccoli with mustache",
        "cool fire dragon blowing colorful bubble gum"
    ];
    const randomIndex = Math.floor(Math.random() * ideas.length);
    const promptInput = document.getElementById("prompt");
    if (promptInput) {
        promptInput.value = ideas[randomIndex];
    }
}

async function generateEmoji() {
    const promptInput = document.getElementById("prompt");
    const style = document.getElementById("style").value;
    const outputDiv = document.getElementById("output");
    const loading = document.getElementById("loading");

    const prompt = promptInput.value.trim();
    if (!prompt) {
        showToast("Please enter a prompt!", "error");
        promptInput.focus();
        return;
    }

    loading.classList.remove("hidden");
    outputDiv.innerHTML = "";

    const payload = {
        prompt: prompt,
        style: style,
        is_gif: (style === "GIF")
    };

    try {
        const response = await fetch(`${BACKEND_URL}/generate-emoji`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        loading.classList.add("hidden");

        if (data.image) {
            const mimeType = (style === "GIF") ? "image/gif" : "image/png";
            const fileExt = (style === "GIF") ? "gif" : "png";
            const dataUrl = `data:${mimeType};base64,${data.image}`;

            outputDiv.innerHTML = `
                <img src="${dataUrl}" class="generated-img" />
                <div class="action-buttons">
                    <button class="action-btn primary" onclick="downloadImage('${data.image}', '${fileExt}')">⬇️ Download</button>
                    <button class="action-btn" onclick="copyImage('${data.image}', '${mimeType}')">📋 Copy</button>
                    <button class="action-btn" onclick="shareImage('${dataUrl}', '${fileExt}')">🔗 Share</button>
                </div>
            `;
            
            showToast("Emoji generated successfully!");
            saveToHistory(data.image, fileExt, mimeType, style);
            updateStats(style);
        } else {
            showToast(data.error || "Generation failed", "error");
        }
    } catch (error) {
        loading.classList.add("hidden");
        console.error("generateEmoji fetch error:", error);
        showToast(`Connection error to ${BACKEND_URL}. Is the backend running?`, "error");
    }
}


// --- Action Handlers ---
function downloadImage(base64, ext = "png") {
    const mimeType = (ext === "gif") ? "image/gif" : "image/png";
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,` + base64;
    link.download = `ai_emoji_${Date.now()}.${ext}`;
    link.click();
    showToast("Download started!");
}

async function copyImage(base64, mimeType) {
    try {
        const res = await fetch(`data:${mimeType};base64,${base64}`);
        const blob = await res.blob();
        await navigator.clipboard.write([
            new ClipboardItem({ [mimeType]: blob })
        ]);
        showToast("Image copied to clipboard!");
    } catch (err) {
        console.error("Copy failed:", err);
        showToast("Failed to copy image. Browser block?", "error");
    }
}

async function shareImage(dataUrl, ext) {
    try {
        if (!navigator.share) {
            showToast("Share API not supported on this browser.", "error");
            return;
        }
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `emoji.${ext}`, { type: blob.type });
        
        await navigator.share({
            title: 'My AI Emoji',
            text: 'Check out this emoji I generated!',
            files: [file]
        });
        showToast("Shared successfully!");
    } catch (err) {
        console.error("Share failed:", err);
    }
}


// --- History & Data Management ---
function saveToHistory(base64, ext, mimeType, style) {
    const history = JSON.parse(localStorage.getItem("emojiHistory") || "[]");
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    // Add to beginning of array, save timestamp
    history.unshift({ base64, ext, mimeType, dataUrl, style, timestamp: Date.now() });
    
    // Keep only last 30 for the gallery
    if (history.length > 30) {
        history.pop();
    }
    
    localStorage.setItem("emojiHistory", JSON.stringify(history));
}

function renderHistoryGrid() {
    const historyGrid = document.getElementById("history-grid");
    const emptyHistory = document.getElementById("empty-history");
    const history = JSON.parse(localStorage.getItem("emojiHistory") || "[]");
    
    historyGrid.innerHTML = "";
    
    if (history.length === 0) {
        emptyHistory.classList.remove("hidden");
        historyGrid.style.display = "none";
        return;
    }

    emptyHistory.classList.add("hidden");
    historyGrid.style.display = "grid";

    history.forEach(item => {
        const card = document.createElement("div");
        card.className = "history-card";
        
        card.innerHTML = `
            <img src="${item.dataUrl}" alt="Emoji" />
            <div class="overlay-actions">
                <button class="overlay-btn" onclick="downloadImage('${item.base64}', '${item.ext}')">⬇️ Save</button>
                <button class="overlay-btn" onclick="copyImage('${item.base64}', '${item.mimeType}')">📋 Copy</button>
            </div>
        `;
        
        historyGrid.appendChild(card);
    });
}


// --- Profile Stats ---
function updateStats(style) {
    const stats = JSON.parse(localStorage.getItem("emojiStats") || '{"total": 0, "styles": {}}');
    
    stats.total += 1;
    stats.styles[style] = (stats.styles[style] || 0) + 1;
    
    localStorage.setItem("emojiStats", JSON.stringify(stats));
}

function renderProfileStats() {
    const stats = JSON.parse(localStorage.getItem("emojiStats") || '{"total": 0, "styles": {}}');
    
    document.getElementById("stat-total").innerText = stats.total;
    
    let favStyle = "N/A";
    let max = 0;
    for (const [styleName, count] of Object.entries(stats.styles)) {
        if (count > max) {
            max = count;
            favStyle = styleName;
        }
    }
    
    // Capitalize first letter
    if (favStyle !== "N/A") {
        favStyle = favStyle.charAt(0).toUpperCase() + favStyle.slice(1).replace(" emoji", "");
    }
    document.getElementById("stat-favorite").innerText = favStyle;
}

function clearData() {
    if(confirm("Are you sure you want to delete all history and stats? This cannot be undone.")) {
        localStorage.removeItem("emojiHistory");
        localStorage.removeItem("emojiStats");
        showToast("All data cleared successfully");
        renderProfileStats(); // Refresh stats view
    }
}


// --- PWA Installation ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById("install-btn");
    if (installBtn) {
        installBtn.classList.remove("hidden");
        installBtn.addEventListener("click", async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
                installBtn.classList.add("hidden");
                showToast("Thanks for installing!");
            }
        });
    }
});