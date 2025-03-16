import os

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

    curr_time = 0
    with open(replay_filename, 'r') as file:
        first_line = file.readline().strip()
        if first_line != schema_version:
            print(f'Incompatible replay schema. Needs schema "{schema_version}" has "{first_line}"')
            exit(1)

        while True:
            # json.loads(json_str)
            line = file.readline()
            if not line:
                break
            # Process the line
            print(line)
