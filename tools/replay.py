import json
import os
import time
import requests

def get_alphabetically_largest_file(directory_path) -> str:
    try:
        files = [f for f in os.listdir(directory_path) if os.path.isfile(os.path.join(directory_path, f))]

        if not files:
            print("No files in replay dir")
            exit(1)

        return max(files)

    except Exception as e:
        print(f"Error: {e}")
        exit(1)

schema_version = "schema 1"



if __name__ == '__main__':
    replay_dir = '../replays/'
    replay_filename = replay_dir + get_alphabetically_largest_file(replay_dir)
    print(replay_filename)

    time_offset = 0
    last_sent_relative = 0
    start_time = time.time()
    URL = "http://localhost:3000/batch"

    with open(replay_filename, 'r') as file:
        first_line = file.readline().strip()
        if first_line != schema_version:
            print(f'Incompatible replay schema. Needs schema "{schema_version}" has "{first_line}"')
            exit(1)

        while True:
            line = file.readline()
            if not line:
                break

            data = json.loads(line)

            sent_timestamp = data['sent_timestamp']/1000

            if time_offset == 0:
                time_offset = sent_timestamp



            sent_relative = sent_timestamp - time_offset
            curr_relative = time.time()-start_time
            if sent_relative > curr_relative:
                time.sleep(sent_relative-curr_relative)

            last_sent_relative = sent_relative
            try:
                r = requests.post(url=URL, data=line)
            except:
                print("Failed to send data to server")
