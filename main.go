package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

func PrettyPrint(v interface{}) {
	// Marshal the struct with indentation
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		fmt.Println("error:", err)
		return
	}
	fmt.Println(string(b))
}

type GraphableNumber struct {
	FieldName string `json:"fieldName"`
	Value     int    `json:"value"`
}

// Custom handler that prints request details and serves static files
func fileServerHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("Requested URL Path: %s\n", r.URL.Path)
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
	// r.GetBody().
}

func main() {
	println("Started")
	mux := http.NewServeMux()

	mux.HandleFunc("/", fileServerHandler)

	if err := http.ListenAndServe(":3000", mux); err != nil {
		log.Fatal(err)
	}
}
