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
SCHEMA_VERSION = "schema 1"




#################
import base64

# Your base64 string (example only — replace with your actual string)
base64_string = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."

# If the base64 string includes the data URI scheme, remove the prefix
if base64_string.startswith("data:"):
    base64_string = base64_string.split(",")[1]

# Decode the base64 string
image_data = base64.b64decode(base64_string)

# Save the decoded data to an image file
with open("output_image.png", "wb") as f:
    f.write(image_data)

print("Image saved as output_image.png")

#################



def base64_to_png(base64_string, output_file):
    """Converts a base64 string to a PNG image file.

    Args:
        base64_string: The base64 encoded string of the image.
        output_file: The path to save the PNG image.
    """
    try:
        # Decode the base64 string
        image_data = base64.b64decode(base64_string)
        # Create an image object from the decoded data
        image = Image.open(io.BytesIO(image_data))
        # Save the image as PNG
        image.save(output_file, 'PNG')
        print(f"Image saved as {output_file}")

    except Exception as e:
        print(f"Error: {e}")

def export_video(frames, url,path):
    frame_count = defaultdict(int)
    # for i in range(len(frames)):
    os.makedirs("image-export/", exist_ok=True)
    print(json.loads(frames[0]['line']).keys())
    for frame in frames:
        for image_name, image_data in json.loads(frame['line'])['images'].items():
            os.makedirs(f"image-export/{image_name}", exist_ok=True)

            # base_64_image_string = f'data:image/png;base64,{image_data['image_data']}'
            number = frame_count[image_name]
            frame_count[image_name] += 1
            decoded_image = base64.b64decode(image_data['image_data'])

            with open(f"image-export/{image_name}/{number}.jpg", "wb") as f:
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
