import requests, random, argparse
from time import sleep
import random

POINTS_PER_CHUNK = 1
REQUEST_INTERVAL = 0.1
URL = "http://localhost:3000"
PATH = "/batch"

argparser = argparse.ArgumentParser(
    prog="simulate-robot",
    description="Simulate robot requests to Go server for testing purposes."
)

argparser.add_argument("-host", "--host", type=str, help="the host you want to send /batch requests to. The default is http://localhost:3000")
argparser.add_argument("-i", "--interval", type=float, help="the time in seconds between requests. The default is 0.1 ")
argparser.add_argument("-n", "--numpoints", type=int, help="the number of data points to send in each request. The default is 1")

def main():
    args = argparser.parse_args()
    if args.host:
        HOST = args.host
    if args.interval:
        REQUEST_INTERVAL = args.interval
    if args.numpoints:
        POINTS_PER_CHUNK = args.numpoints

    while True:
        data = {
            "graphable-numbers": {
                "Yaw": [],
                "Pitch": [],
            }
        }
        for i in range(POINTS_PER_CHUNK):
            data["graphable-numbers"]["Yaw"].append(int(random.betavariate(2, 5)*360))
            data["graphable-numbers"]["Pitch"].append(int(random.betavariate(2, 2) * 20 - 10))
        res = requests.post(HOST+PATH, json=data)
        sleep(REQUEST_INTERVAL)

    
    

    pass

if __name__ == "__main__":
    main()