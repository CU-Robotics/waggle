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
	GraphName string  `json:"graphName"`
	Value     float64 `json:"value"`
}

func graphNumberHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	var data GraphableNumber
	err = json.Unmarshal(body, &data)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	clientData := ClientData{
		Type: "graph_number",
		Data: data,
	}
	updateWSClients(clientData)
}

type RobotPosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

func setRobotPositionHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	var data RobotPosition
	err = json.Unmarshal(body, &data)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	clientData := ClientData{
		Type: "set_robot_position",
		Data: data,
	}
	updateWSClients(clientData)
}

func main() {
	println("Started")

	router := mux.NewRouter().StrictSlash(true)

	router.Methods("POST").Path("/graph-number").Name("graphNumberHandler").Handler(LoggerHandler(http.HandlerFunc(graphNumberHandler), "graphNumberHandler"))
	router.Methods("POST").Path("/robot-position").Name("setRobotPositionHandler").Handler(LoggerHandler(http.HandlerFunc(setRobotPositionHandler), "setRobotPositionHandler"))

	router.Methods("GET").Path("/ws").Name("WebSocketStart").Handler(http.HandlerFunc(wsHandler))

	staticDir := "./static/"
	fs := http.FileServer(http.Dir(staticDir))
	router.NotFoundHandler = fs

	log.Fatal(http.ListenAndServe(":3000", router))

}
