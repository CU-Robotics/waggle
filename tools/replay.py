import os
import json
import time
import argparse
import curses
import requests
from typing import List, Dict

SCHEMA_VERSION = "schema 1"

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

def send_frame(url: str, frames: List, idx: int):
    frame_data = json.loads(frames[idx]['line'])
    frame_data['graph_data']['WAGGLE_REPLAY_FRAME']=[{'x':time.time(),'y':idx}]
    frame_data['save_replay'] = False
    line = json.dumps(frame_data)
    try:
        requests.post(url, data=line)
    except Exception:
        pass

def main(stdscr, frames, url,path):
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.clear()

    idx = 0
    playing = 0
    start_time = 0
    start_rel = 0
    last_frame_time = 0

    while True:
        ch = stdscr.getch()
        if ch != -1:
            key = chr(ch)
            if key in ('q'):
                break
            elif key in ('p'):
                start_time = time.time()
                start_rel = frames[idx]['rel']
                playing = 1

            elif key in ('o'):
                start_time = time.time()
                start_rel = frames[idx]['rel']
                playing = -1

            elif key == 'l':
                playing = 0
                if idx < len(frames)-1:
                    idx += 1
                    send_frame(url, frames, idx)
            elif key == 'k':
                playing = 0
                if idx >0:
                    idx -= 1
                    send_frame(url, frames, idx)

        if playing != 0:
            now = time.time()
            if playing > 0:
                if idx < len(frames)-1:
                    elapsed = now - start_time
                    next_frame_rel = frames[idx+1]['rel']
                    if elapsed >= next_frame_rel - start_rel:
                        if now - last_frame_time >= 0.01:
                            idx += 1
                            send_frame(url, frames, idx)
                            last_frame_time = now

                if idx >= len(frames)-1:
                    playing = 0
            else:
                if idx > 0:
                    elapsed = now - start_time
                    prev_frame_rel = frames[idx-1]['rel']
                    if elapsed >= start_rel - prev_frame_rel:
                        if now - last_frame_time >= 0.01:
                            idx -= 1
                            send_frame(url, frames, idx)
                            last_frame_time = now

                if idx <= 0:
                    playing = 0


        r = 0
        stdscr.erase()
        stdscr.addstr(r, 0, f'Waggle Replay — {path}')
        r+=1
        stdscr.addstr(r, 0, 'p/o to play forward/back • l/k to Step forward/back • q to Quit')
        r+=1
        r+=1

        status = "▶ Playing" if playing else "❚❚ Paused "
        stdscr.addstr(r, 0, f"Status     : {status}")
        r+=1
        stdscr.addstr(r, 0, f"Frame      : {idx} / {len(frames)}")
        r+=1

        stdscr.addstr(r, 0, f"Playing      : {playing}")
        r+=1

        if idx < len(frames):
            next_time = frames[idx]['rel']
            stdscr.addstr(4, 0, f"Next @ +{next_time:.2f}s")
        stdscr.refresh()

        time.sleep(0.01)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--replay-dir", default="../replays", help="Directory containing replay files")
    p.add_argument("--url", default="http://localhost:3000/batch", help="Waggle endpoint")
    p.add_argument("--file", default="", help="file name, relative to the replay dir")

    args = p.parse_args()

    filename = args.file
    if filename == '':
        filename = find_latest_file(args.replay_dir)
    path = os.path.join(args.replay_dir, filename)
    print(f"Loading replay: {path}")
    frames = load_frames(path)

    curses.wrapper(main, frames, args.url, path)
