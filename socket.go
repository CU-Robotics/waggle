package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/jpeg"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/disintegration/imaging"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all connections by default
	},
}

var clients = make(map[*websocket.Conn]bool)

var clientsMutex = &sync.Mutex{}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading to WebSocket:", err)
		return
	}
	defer conn.Close()

	clientsMutex.Lock()
	clients[conn] = true
	clientsMutex.Unlock()

	for {
		_, _, err := conn.ReadMessage()

		if err != nil {
			log.Println("Error reading message:", err)
			break
		}
		if readyToSend {
			broadcastMessage()
		} else {
			readyToSend = true
		}
	}

	clientsMutex.Lock()
	delete(clients, conn)
	clientsMutex.Unlock()
}

var buffer []RobotData = make([]RobotData, 0)

func broadcastMessage() {
	clientsMutex.Lock()
	defer clientsMutex.Unlock()

	var message []byte

	// println("broadcasting", len(buffer))
	if len(buffer) == 0 {
		message = []byte("[]")
	} else {
		var err error
		for i, robot_data := range buffer {
			if i != len(buffer)-1 {
				robot_data.Images = map[string]ImageData{}
				continue
			}
			for image_name, image_data := range robot_data.Images {
				reader := base64.NewDecoder(base64.StdEncoding, strings.NewReader(image_data.ImageData))
				m, _, err := image.Decode(reader)
				if err != nil {
					log.Fatal(err)
				}

				dstImageFit := imaging.Fit(m, 500, 500, imaging.Lanczos)

				var buf bytes.Buffer
				err = jpeg.Encode(&buf, dstImageFit, &jpeg.Options{Quality: 80})
				if err != nil {
					log.Fatal(err)
				}

				image_data.ImageData = base64.StdEncoding.EncodeToString(buf.Bytes())
				robot_data.Images[image_name] = image_data
			}
		}
		message, err = json.Marshal(buffer)
		if err != nil {
			log.Println("Error marshalling JSON:", err)
			return
		}

	}
	for client := range clients {
		err := client.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Println("Error writing message to client:", err)
			client.Close()
			delete(clients, client)
		}
	}
	readyToSend = false

	buffer = []RobotData{}
}

func addDataToBuffer(data RobotData) {
	buffer = append(buffer, data)

	//TODO: configurable max-buffer size
	if len(buffer) > 10 {
		buffer = buffer[1:]
	}
}
