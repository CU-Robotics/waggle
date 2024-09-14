package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func graphableNumberHandler(graphCollection *GraphCollection) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			log.Println(err)
			return
		}

		var graphableNumberRequest GraphableNumber
		err = json.Unmarshal(body, &graphableNumberRequest)
		if err != nil {
			w.Write([]byte("Error!"))
			log.Println(err)
			return
		}

		PrettyPrint(graphableNumberRequest)
		graphCollection.InsertValue(graphableNumberRequest.FieldName, graphableNumberRequest.Value)

		w.Write([]byte("Success!"))
	}
}

func main() {
	println("Started")

	var graphCollection GraphCollection
	graphCollection.Init()

	router := mux.NewRouter().StrictSlash(true)

	router.Methods("POST").Path("/graphable-number").Name("graphableNumberHandler").Handler(LoggerHandler(http.HandlerFunc(graphableNumberHandler(&graphCollection)), "graphableNumberHandler"))

	log.Fatal(http.ListenAndServe(":3000", router))
}
