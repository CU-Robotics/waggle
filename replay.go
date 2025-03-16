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
	"strconv"
	"strings"
	"time"

	"github.com/disintegration/imaging"
)

type ReplayManager struct {
	file *os.File
}

func (r *ReplayManager) init_replay() {
	var err error
	folder_name := "replays/"

	filename := folder_name + strconv.FormatInt(time.Now().Unix(), 10) + ".waggle"

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
	b, err := json.Marshal(robot_data)
	if err != nil {
		fmt.Println(err)
		return
	}
	for image_name, image_data := range robot_data.Images {
		reader := base64.NewDecoder(base64.StdEncoding, strings.NewReader(image_data.ImageData))
		m, _, err := image.Decode(reader)
		if err != nil {
			log.Fatal(err)
		}
		dstImageFit := imaging.Fit(m, 500, 500, imaging.Lanczos)
		var buf bytes.Buffer

		jpeg.Encode(&buf, dstImageFit, &jpeg.Options{Quality: 25})
		image_data.ImageData = string(buf)
		robot_data.Images[image_name] = image_data
	}

	// println(string(b))
	_, err = r.file.Write(b)
	if err != nil {
		println(err.Error())
	}
	r.file.WriteString("\n")
}
