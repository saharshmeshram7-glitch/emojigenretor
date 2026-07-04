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
    outputDiv.innerHTML = "";

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/generate-emoji",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt: `${prompt} ${style}`
                })
            }
        );

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

        outputDiv.innerHTML = `
            <p style="color:red;">
                Server Error!
            </p>
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