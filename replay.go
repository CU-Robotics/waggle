package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/disintegration/imaging"
)

// If there is no data for REPLAY_TIMEOUT milliseconds, this will be counted as a new replay
var REPLAY_TIMEOUT int64 = 3000

type ReplayManager struct {
	file        *os.File
	file_guard  sync.Mutex
	last_update int64
}

func (r *ReplayManager) init_replay() {
	if r.file != nil {
		r.file.Close()
	}

	var err error
	folder_name := "replays/"

	filename := folder_name + time.Now().Local().String() + ".waggle"

	os.Mkdir(folder_name, os.ModePerm)

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
		print("Missed write update because locked mutex")
		return
	}
	defer r.file_guard.Unlock()

	curr_time := time.Now().UnixMilli()
	if curr_time-r.last_update > REPLAY_TIMEOUT {
		r.init_replay()
	}
	r.last_update = curr_time

	for image_name, image_data := range robot_data.Images {
		reader := base64.NewDecoder(base64.StdEncoding, strings.NewReader(image_data.ImageData))
		m, _, err := image.Decode(reader)
		if err != nil {
			log.Fatal(err)
		}

		dstImageFit := imaging.Fit(m, 500, 500, imaging.Lanczos)

		var buf bytes.Buffer

		err = jpeg.Encode(&buf, dstImageFit, &jpeg.Options{Quality: 25})
		if err != nil {
			log.Fatal(err)
		}

		image_data.ImageData = base64.StdEncoding.EncodeToString(buf.Bytes())
		robot_data.Images[image_name] = image_data
	}

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
