package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
)

type ClientData struct {
	Type      string      `json:"type"`
	Timestamp int64       `json:"timestamp"`
	Data      interface{} `json:"data"`
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


type CvMat struct {
	MatName string `json:"matName"`
	Base64 string `json:"base64"`
}


func cvMatHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	var data CvMat
	err = json.Unmarshal(body, &data)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	clientData := ClientData{
		Type: "display_cv_mat",
		Data: data,
	}
	updateWSClients(clientData)
}


type folder struct {
	FolderPath string `json:"folderPath"`
}
type folderResponse struct {
	FileName string `json:"filename"`
	IsDir bool `json:"isdir"`
}

func getFolderHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Getting folder")

	folderPath := r.URL.Query().Get("folderPath")

	entries, err := os.ReadDir(folderPath)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println("entries")
		log.Println(err)
		return
	}

	numFiles := len(entries)
	responseDataArray := make([]folderResponse, numFiles)

	for i:=0; i < numFiles; i++ {
		responseDataArray[i].FileName = entries[i].Name()
		responseDataArray[i].IsDir = entries[i].IsDir() 
	}

	jsonBytes, err := json.Marshal(responseDataArray)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println("marshalling jsonBytes")
		log.Println(err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(jsonBytes)
}



func corsHandler(h http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        log.Print("preflight detected: ", r.Header)
        w.Header().Add("Connection", "keep-alive")
        w.Header().Add("Access-Control-Allow-Origin", "http://localhost:3000")
        w.Header().Add("Access-Control-Allow-Methods", "POST, OPTIONS, GET, DELETE, PUT")
        w.Header().Add("Access-Control-Allow-Headers", "content-type")
        w.Header().Add("Access-Control-Max-Age", "86400")

        // continue with my method
        getFolderHandler(w, r)
    }
}

func main() {
	println("Started")

	router := mux.NewRouter().StrictSlash(true)

	router.Methods("POST").Path("/graph-number").Name("graphNumberHandler").Handler(LoggerHandler(http.HandlerFunc(graphNumberHandler), "graphNumberHandler"))
	router.Methods("POST").Path("/robot-position").Name("setRobotPositionHandler").Handler(LoggerHandler(http.HandlerFunc(setRobotPositionHandler), "setRobotPositionHandler"))
	router.Methods("POST").Path("/cv-mat").Name("cvMatHandler").Handler(LoggerHandler(http.HandlerFunc(cvMatHandler), "cvMatHandler"))
	router.Methods("GET").Path("/ws").Name("WebSocketStart").Handler(http.HandlerFunc(wsHandler))

	// File editor
	router.Methods("GET").Path("/getFolder").Name("getFolderHandler").Handler(LoggerHandler(corsHandler(http.HandlerFunc(getFolderHandler)), "getFolderHandler"))

	staticDir := "./static/"
	fs := http.FileServer(http.Dir(staticDir))
	router.NotFoundHandler = fs

	log.Fatal(http.ListenAndServe(":3000", router))

}
