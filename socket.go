package main

import (
	"encoding/json"
	"fmt"
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
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("Error reading message:", err)
			break
		}

		fmt.Printf("Received: %s\n", message)

		broadcastMessage(message)
	}

	clientsMutex.Lock()
	delete(clients, conn)
	clientsMutex.Unlock()
}

func broadcastMessage(message []byte) {
	clientsMutex.Lock()
	defer clientsMutex.Unlock()
	for client := range clients {
		err := client.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Println("Error writing message to client:", err)
			client.Close()
			delete(clients, client)
		}
	}
}

func updateWSClients(data interface{}) {
	message, err := json.Marshal(data)
	if err != nil {
		log.Println("Error marshalling JSON:", err)
		return
	}
	broadcastMessage(message)
}
