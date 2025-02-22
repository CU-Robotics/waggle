package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

type ImageData struct {
	ImageData string `json:"image_data"`
	Scale     int    `json:"scale"`
	Flip      bool   `json:"flip"`
}

type GraphDataPoint struct {
	X        float64           `json:"x"`
	Y        float64           `json:"y"`
	Settings GraphDataSettings `json:"settings"`
}
type GraphDataSettings struct {
	ClearData bool `json:"clear_data"`
}

type RobotPosition struct {
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	Heading float64 `json:"heading"`
}

type StringData struct {
	Value string `json:"value"`
}

type RobotData struct {
	SentTimestamp float64                     `json:"sent_timestamp"`
	Images        map[string]ImageData        `json:"images"`
	GraphData     map[string][]GraphDataPoint `json:"graph_data"`
	StringData    map[string]StringData       `json:"string_data"`
	RobotPosition RobotPosition               `json:"robot_position"`
}

type ResponeData struct {
	InitiallySentTimestamp float64 `json:"initially_sent_timestamp"`
}

var readyToSend bool = false

func batchHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	var data RobotData
	err = json.Unmarshal(body, &data)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)

		log.Println("Body:", string(body))
		return
	}
	addDataToBuffer(data)
	if readyToSend {
		broadcastMessage()
	}
}

func main() {
	println("Started")

	router := mux.NewRouter().StrictSlash(true)

	router.Methods("POST").Path("/batch").Name("batchHandler").Handler(LoggerHandler(http.HandlerFunc(batchHandler), "batchHandler"))
	router.Methods("GET").Path("/ws").Name("WebSocketStart").Handler(http.HandlerFunc(wsHandler))

	// File editor
	router.Methods("POST").Path("/get-folder").Name("getFolderHandler").Handler(LoggerHandler(http.HandlerFunc(getFolderHandler), "getFolderHandler"))
	router.Methods("POST").Path("/get-file").Name("getFileHandler").Handler(LoggerHandler(http.HandlerFunc(getFileHandler), "getFileHandler"))
	router.Methods("POST").Path("/put-file").Name("putFileHandler").Handler(LoggerHandler(http.HandlerFunc(putFileHandler), "putFileHandler"))

	staticDir := "./client/dist/"
	fs := http.FileServer(http.Dir(staticDir))
	router.NotFoundHandler = fs

	log.Fatal(http.ListenAndServe(":3000", router))

}
