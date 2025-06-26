import os
import json
import time
import argparse
import curses
import requests
from typing import List, Dict
from collections import defaultdict
import base64
import base64
from PIL import Image
import io
from tqdm import tqdm 

SCHEMA_VERSION = "schema 1"

def export_video(frames, url,path):
    frame_count = defaultdict(int)
    os.makedirs("image-export/", exist_ok=True)
    print(json.loads(frames[0]['line']).keys())
    for frame in tqdm(frames):
        for image_name, image_data in json.loads(frame['line'])['images'].items():
            os.makedirs(f"image-export/{image_name}", exist_ok=True)

            number = frame_count[image_name]
            frame_count[image_name] += 1
            decoded_image = base64.b64decode(image_data['image_data'])

            with open(f"image-export/{image_name}/{number:08}.jpg", "wb") as f:
                f.write(decoded_image)
                

def find_latest_file(directory: str) -> str:
    try:
        files = [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]
        if not files:
            print("No files in replay dir")
            exit(1)
        return max(files)
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

def load_frames(path: str) -> List[Dict]:
    frames = []
    with open(path, 'r') as f:
        header = f.readline().strip()
        if header != SCHEMA_VERSION:
            print(f'Incompatible replay schema. Needs "{SCHEMA_VERSION}", found "{header}"')
            exit(1)
        first_ts = None
        for raw in f:
            data = json.loads(raw)
            sent_ts = data['sent_timestamp'] / 1000.0
            if first_ts is None:
                first_ts = sent_ts
            frames.append({
                "rel": sent_ts - first_ts,
                "line": raw
            })
    return frames

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--replay-dir", default="../replays", help="Directory containing replay files")
    p.add_argument("--url", default="http://localhost:3000/batch", help="Waggle endpoint")
    p.add_argument("--file", default="", help="file name, relative to the replay dir")

    args = p.parse_args()

    filename = args.file
    if filename == '':
        filename = find_latest_file(args.replay_dir)
    
    path = ''
    if os.path.isabs(filename):
        path = filename
    else:
        path = os.path.join(args.replay_dir, filename)
    print(f"Loading replay: {path}")
    frames = load_frames(path)

    export_video(frames, args.url, path)
