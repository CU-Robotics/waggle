import requests, random
from time import sleep
import random

ITEMS_PER_CHUNK = 1
CHUNKS_INTERVAL = 0.1
URL = "http://localhost:3000/batch"

def main():
    while True:
        data = {
            "graphable-numbers": {
                "Yaw": [],
                "Pitch": [],
            }
        }
        for i in range(ITEMS_PER_CHUNK):
            data["graphable-numbers"]["Yaw"].append(int(random.betavariate(2, 5)*360))
            data["graphable-numbers"]["Pitch"].append(int(random.betavariate(2, 2) * 20 - 10))
        res = requests.post(URL, json=data)
        sleep(CHUNKS_INTERVAL)

    
    

    pass

if __name__ == "__main__":
    main()