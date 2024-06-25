package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
)

var (
	dataStore = make(map[string]interface{})
	mu        sync.Mutex
)

func main() {
	var PORT = 8080
	http.HandleFunc("/set", jsonHandler)
	http.HandleFunc("/getall", printHandler)
	fmt.Printf("Server is listening on port %d...", PORT)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", PORT), nil))
}

func jsonHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Unable to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var jsonData map[string]interface{}
	if err := json.Unmarshal(body, &jsonData); err != nil {
		http.Error(w, "Invalid JSON data", http.StatusBadRequest)
		return
	}

	mu.Lock()
	for key, value := range jsonData {
		dataStore[key] = value
	}
	mu.Unlock()

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Data stored successfully")
}

func printHandler(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()

	jsonData, err := json.MarshalIndent(dataStore, "", "  ")
	if err != nil {
		http.Error(w, "Error converting data to JSON", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(jsonData)
}
