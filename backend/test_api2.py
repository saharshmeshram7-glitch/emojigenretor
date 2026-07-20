import requests
import random
print("Testing GET image.pollinations.ai")
for prompt in ["dog", "cat", "car"]:
    url = f"https://image.pollinations.ai/prompt/{prompt}?seed={random.randint(1,1000)}&nologo=true"
    print(f"Requesting {url}")
    try:
        r = requests.get(url, timeout=30)
        print(f"Status: {r.status_code}, Size: {len(r.content)}")
    except Exception as e:
        print(f"Error: {e}")
