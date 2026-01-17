async function generateEmoji() {
    const promptInput = document.getElementById("prompt");
    const outputDiv = document.getElementById("output");

    const prompt = promptInput.value.trim();

    if (!prompt) {
        alert("Please enter a prompt!");
        return;
    }

    outputDiv.innerHTML = "<p>Generating emoji...</p>";

    try {
        const response = await fetch("http://127.0.0.1:5000/generate-emoji", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();

        if (data.image) {
            outputDiv.innerHTML = `
                <img src="data:image/png;base64,${data.image}" alt="Generated Emoji">
            `;
        } else {
            outputDiv.innerHTML = "<p>Failed to generate emoji.</p>";
        }

    } catch (error) {
        outputDiv.innerHTML = "<p>Error connecting to server.</p>";
        console.error(error);
    }
}
