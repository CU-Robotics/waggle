package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
	"path/filepath"
	"sort"
	"io/ioutil"
)

// If there is no data for REPLAY_TIMEOUT milliseconds, this will be counted as a new replay
var REPLAY_TIMEOUT int64 = 3000

type ReplayManager struct {
	file        *os.File
	file_guard  sync.Mutex
	last_update int64
}

const MAX_FOLDER_SIZE_MB = 5000 // Limit in megabytes
const MAX_FILE_SIZE_MB = 1000

func get_folder_size(path string) (int64, error) {
    var size int64 = 0
    err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
        if err != nil {
            return err
        }
        if !info.IsDir() {
            size += info.Size()
        }
        return nil
    })
    return size, err
}

func delete_oldest_files(folder string, maxSize int64) error {
    files, err := ioutil.ReadDir(folder)
    if err != nil {
        return err
    }

    // Sort files by ModTime (oldest first)
    sort.Slice(files, func(i, j int) bool {
        return files[i].ModTime().Before(files[j].ModTime())
    })

    var totalSize int64
    for _, file := range files {
        totalSize += file.Size()
    }

    // Delete oldest files until we're under the limit
    for _, file := range files {
        if totalSize <= maxSize {
            break
        }
		println("Deleting file: " + file.Name())
        err := os.Remove(filepath.Join(folder, file.Name()))
        if err != nil {
            return err
        }
        totalSize -= file.Size()
    }
    return nil
}

func (r *ReplayManager) init_replay() {
	if r.file != nil {
		r.file.Close()
	}


	var err error
	folder_name := "replays/"
	timestamp := time.Now().Local().Format("2006-01-02_15-04-05")
	filename := folder_name + timestamp + ".waggle"

	os.Mkdir(folder_name, os.ModePerm)

    maxSizeBytes := int64(MAX_FOLDER_SIZE_MB) * 1024 * 1024
    folderSize, err := get_folder_size(folder_name)
    if err == nil && folderSize > maxSizeBytes {
        err = delete_oldest_files(folder_name, maxSizeBytes)
        if err != nil {
            panic(err)
        }
    }

	r.file, err = os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		panic(err)
	}
	r.file.WriteString("schema 1")
	r.file.WriteString("\n")
}

func (r *ReplayManager) close() {
	r.file.Close()
}

func (r *ReplayManager) write_update(robot_data RobotData) {
	if !r.file_guard.TryLock() {
		print("Missed write update because locked mutex\n")
		return
	}
	defer r.file_guard.Unlock()

	curr_time := time.Now().UnixMilli()
	should_reinit := false

	if curr_time-r.last_update > REPLAY_TIMEOUT {
		should_reinit = true
	}

	
	if r.file != nil {
		stat, err := r.file.Stat()
		if err != nil {
			fmt.Printf("Failed to stat replay file: %v\n", err)
			should_reinit = true // play it safe
		} else if stat.Size() > int64(MAX_FILE_SIZE_MB)*1024*1024 {
			should_reinit = true
		}
	} else {
		fmt.Println("Replay file is nil, reinitializing")
		should_reinit = true
	}

	if should_reinit {
		fmt.Println("Replay timeout or file size exceeded, creating new replay")
		r.init_replay()
	}
	r.last_update = curr_time

	// for image_name, image_data := range robot_data.Images {
	// 	reader := base64.NewDecoder(base64.StdEncoding, strings.NewReader(image_data.ImageData))
	// 	m, _, err := image.Decode(reader)
	// 	if err != nil {
	// 		log.Fatal(err)
	// 	}

	// 	dstImageFit := imaging.Fit(m, 500, 500, imaging.Lanczos)

	// 	var buf bytes.Buffer

	// 	err = jpeg.Encode(&buf, dstImageFit, &jpeg.Options{Quality: 25})
	// 	if err != nil {
	// 		log.Fatal(err)
	// 	}

	// 	image_data.ImageData = base64.StdEncoding.EncodeToString(buf.Bytes())
	// 	robot_data.Images[image_name] = image_data
	// }

	b, err := json.Marshal(robot_data)
	if err != nil {
		fmt.Println(err)
		return
	}
	// println(string(b))
	_, err = r.file.Write(b)
	if err != nil {
		println(err.Error())
	}
	r.file.WriteString("\n")
}
