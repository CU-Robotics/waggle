package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

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

func main() {
	println("Started")

	router := mux.NewRouter().StrictSlash(true)

	router.Methods("POST").Path("/graphable-number").Name("graphableNumberHandler").Handler(LoggerHandler(http.HandlerFunc(graphableNumberHandler), "graphableNumberHandler"))

	staticDir := "./static/"
	fs := http.FileServer(http.Dir(staticDir))
	router.NotFoundHandler = fs

	log.Fatal(http.ListenAndServe(":3000", router))

}
