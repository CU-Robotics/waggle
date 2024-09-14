package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

type ClientData struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type GraphableNumber struct {
	FieldName string `json:"fieldName"`
	Value     int    `json:"value"`
}

func graphableNumberHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Println(err)
		return
	}

	var data GraphableNumber
	err = json.Unmarshal(body, &data)
	if err != nil {
		log.Println(err)
		return
	}

	PrettyPrint(data)
}

type RobotPosition struct {
	X float32 `json:"x"`
	Y float32 `json:"y"`
}

func setRobotPositionHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Println(err)
		return
	}

	var data RobotPosition
	err = json.Unmarshal(body, &data)
	if err != nil {
		log.Println(err)
		return
	}

	clientData := ClientData{
		Type: "robot_position",
		Data: data,
	}
	updateWSClients(clientData)
}

func main() {
	println("Started")

	router := mux.NewRouter().StrictSlash(true)

	router.Methods("POST").Path("/graphable-number").Name("graphableNumberHandler").Handler(LoggerHandler(http.HandlerFunc(graphableNumberHandler), "graphableNumberHandler"))
	router.Methods("POST").Path("/robot-position").Name("setRobotPositionHandler").Handler(LoggerHandler(http.HandlerFunc(setRobotPositionHandler), "setRobotPositionHandler"))

	router.Methods("GET").Path("/ws").Name("WebSocketStart").Handler(http.HandlerFunc(wsHandler))

	staticDir := "./static/"
	fs := http.FileServer(http.Dir(staticDir))
	router.NotFoundHandler = fs

	log.Fatal(http.ListenAndServe(":3000", router))

}
