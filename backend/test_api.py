import requests

# Test if POST endpoint returns different images for different prompts
prompts = [
    "a red sports car",
    "a blue ocean wave", 
    "a green forest tree"
]

sizes = []
for p in prompts:
    print(f"Prompt: '{p}'...", end=" ", flush=True)
    try:
        r = requests.post(
            "https://image.pollinations.ai/openai/images/generations",
            json={"prompt": p, "model": "flux", "size": "256x256", "seed": 42},
            timeout=60,
            headers={"Content-Type": "application/json", "Cache-Control": "no-cache, no-store"}
        )
        size = len(r.content)
        sizes.append(size)
        print(f"Status={r.status_code}, Size={size}")
    except Exception as e:
        print(f"Error: {e}")

print(f"\nAll sizes: {sizes}")
print(f"All same? {len(set(sizes)) == 1}")

# Also try with random seed
print("\n=== Same prompt, different seeds ===")
import random
sizes2 = []
for i in range(3):
    seed = random.randint(1, 999999)
    print(f"Seed {seed}...", end=" ", flush=True)
    try:
        r = requests.post(
            "https://image.pollinations.ai/openai/images/generations",
            json={"prompt": "cute cat emoji", "model": "flux", "size": "256x256", "seed": seed},
            timeout=60,
            headers={"Content-Type": "application/json"}
        )
        size = len(r.content)
        sizes2.append(size)
        print(f"Size={size}")
    except Exception as e:
        print(f"Error: {e}")

print(f"\nAll sizes: {sizes2}")
print(f"All same? {len(set(sizes2)) == 1}")
