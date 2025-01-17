import requests, random, argparse
from time import sleep
import random

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
    else:
        HOST = "http://localhost:3000"
    if args.interval:
        REQUEST_INTERVAL = args.interval
    else:
        REQUEST_INTERVAL = 0.1
    if args.numpoints:
        POINTS_PER_CHUNK = args.numpoints
    else:
        POINTS_PER_CHUNK = 1

    while True:
        data = {
            "graphable-numbers": {
                "Yaw": [],
                "Pitch": [],
            }
        }
        data["graphable-numbers"]["Yaw"] = generateYawData(POINTS_PER_CHUNK)
        data["graphable-numbers"]["Pitch"] = generatePitchData(POINTS_PER_CHUNK)

        res = requests.post(HOST+PATH, json=data)
        sleep(REQUEST_INTERVAL)


def generatePitchData(POINTS_PER_CHUNK):
    pitchData = []
    for i in range(POINTS_PER_CHUNK):
        pitchData.append(int(random.betavariate(2, 5)*360))
    return pitchData
def generateYawData(POINTS_PER_CHUNK):
    yawData = []
    for i in range (POINTS_PER_CHUNK):
        yawData.append(int(random.betavariate(2, 2) * 20 - 10))
    return yawData


if __name__ == "__main__":
    main()