package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

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

		broadcastMessage()
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

	if len(buffer) == 0 {
		message = []byte("[]")
	} else {
		var err error
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

	buffer = []RobotData{}
}

func addDataToBuffer(data RobotData) {
	buffer = append(buffer, data)

	if len(buffer) > 10 {
		buffer = buffer[1:]
	}

	// message, err := json.Marshal(data)

	// go broadcastMessage(message)
}
