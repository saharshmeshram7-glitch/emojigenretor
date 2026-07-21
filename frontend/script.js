const LOCAL_BACKEND_URL = "http://127.0.0.1:5000";
const REMOTE_BACKEND_URL = "https://emojigenretor.onrender.com"; // actual backend deployment URL
const BACKEND_URL = window.BACKEND_URL || (
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? LOCAL_BACKEND_URL
        : REMOTE_BACKEND_URL
);

const MAX_HISTORY_ITEMS = 12;

let currentEmoji = null;

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
    const targetBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => btn.getAttribute('onclick')?.includes(tabId));
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
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3400);
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
    const styleSelect = document.getElementById("style");
    const outputDiv = document.getElementById("output");
    const loading = document.getElementById("loading");

    const style = styleSelect.value;
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

            currentEmoji = {
                base64: data.image,
                ext: fileExt,
                mimeType: mimeType,
                dataUrl: dataUrl,
                style: style
            };

            outputDiv.innerHTML = `
                <img src="${dataUrl}" class="generated-img" alt="Generated Emoji" />
                <div class="action-buttons">
                    <button class="action-btn primary" onclick="downloadCurrentEmoji()">⬇️ Download</button>
                    <button class="action-btn" onclick="copyCurrentEmoji()">📋 Copy</button>
                    <button class="action-btn" onclick="shareCurrentEmoji()">🔗 Share</button>
                </div>
            `;
            
            showToast(style === "GIF" ? "Animated GIF generated!" : "Emoji generated successfully!");
            await saveToHistory(dataUrl, fileExt, mimeType, style);
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
function downloadCurrentEmoji() {
    if (!currentEmoji) return;
    downloadImage(currentEmoji.base64, currentEmoji.ext);
}

async function copyCurrentEmoji() {
    if (!currentEmoji) return;
    await copyImage(currentEmoji.base64, currentEmoji.mimeType);
}

async function shareCurrentEmoji() {
    if (!currentEmoji) return;
    await shareImage(currentEmoji.dataUrl, currentEmoji.ext);
}

function normalizeDataUrl(value, mimeType) {
    if (typeof value !== 'string') return '';
    if (value.startsWith('data:')) return value;
    return `data:${mimeType};base64,${value}`;
}

function downloadImage(base64OrDataUrl, ext = "png", mimeType = "image/png") {
    const href = normalizeDataUrl(base64OrDataUrl, mimeType);
    const link = document.createElement('a');
    link.href = href;
    link.download = `ai_emoji_${Date.now()}.${ext}`;
    link.click();
    showToast("Download started!");
}

async function copyImage(base64OrDataUrl, mimeType) {
    try {
        const dataUrl = normalizeDataUrl(base64OrDataUrl, mimeType);
        const res = await fetch(dataUrl);
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
function parseStorageItem(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (err) {
        console.warn(`Storage parse failed for ${key}:`, err);
        return fallback;
    }
}

function safeSetStorageItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (err) {
        if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
            return false;
        }
        throw err;
    }
}

function createThumbnailDataUrl(dataUrl, size = 160) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, size, size);
            const aspect = Math.min(size / img.width, size / img.height);
            const w = img.width * aspect;
            const h = img.height * aspect;
            const x = (size - w) / 2;
            const y = (size - h) / 2;
            ctx.drawImage(img, x, y, w, h);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

async function saveToHistory(dataUrl, ext, mimeType, style) {
    const history = parseStorageItem("emojiHistory", []);
    const thumbnailUrl = await createThumbnailDataUrl(dataUrl);

    history.unshift({ dataUrl: thumbnailUrl, ext, mimeType, style, timestamp: Date.now() });
    while (history.length > MAX_HISTORY_ITEMS) {
        history.pop();
    }

    let stored = safeSetStorageItem("emojiHistory", JSON.stringify(history));
    if (!stored) {
        while (history.length > 0 && !stored) {
            history.pop();
            stored = safeSetStorageItem("emojiHistory", JSON.stringify(history));
        }
        if (!stored) {
            localStorage.removeItem("emojiHistory");
            showToast("History storage is full. Recent emoji saved only for this session.", "error");
        }
    }
}

function renderHistoryGrid() {
    const historyGrid = document.getElementById("history-grid");
    const emptyHistory = document.getElementById("empty-history");
    const history = parseStorageItem("emojiHistory", []);
    
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
        
        const img = document.createElement("img");
        img.src = item.dataUrl;
        img.alt = "Emoji";

        const overlay = document.createElement("div");
        overlay.className = "overlay-actions";

        const saveBtn = document.createElement("button");
        saveBtn.className = "overlay-btn";
        saveBtn.innerText = "⬇️ Save";
        saveBtn.onclick = () => downloadImage(item.dataUrl, item.ext, item.mimeType);

        const copyBtn = document.createElement("button");
        copyBtn.className = "overlay-btn";
        copyBtn.innerText = "📋 Copy";
        copyBtn.onclick = () => copyImage(item.dataUrl, item.mimeType);

        overlay.appendChild(saveBtn);
        overlay.appendChild(copyBtn);

        card.appendChild(img);
        card.appendChild(overlay);

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
    
    const statTotal = document.getElementById("stat-total");
    if (statTotal) statTotal.innerText = stats.total;
    
    let favStyle = "N/A";
    let max = 0;
    for (const [styleName, count] of Object.entries(stats.styles)) {
        if (count > max) {
            max = count;
            favStyle = styleName;
        }
    }
    
    if (favStyle !== "N/A") {
        favStyle = favStyle.charAt(0).toUpperCase() + favStyle.slice(1).replace(" emoji", "");
    }
    const statFav = document.getElementById("stat-favorite");
    if (statFav) statFav.innerText = favStyle;
}

function clearData() {
    if(confirm("Are you sure you want to delete all history and stats? This cannot be undone.")) {
        localStorage.removeItem("emojiHistory");
        localStorage.removeItem("emojiStats");
        showToast("All data cleared successfully");
        renderProfileStats();
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
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const installBtn = document.getElementById("install-btn");
    if (installBtn) {
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