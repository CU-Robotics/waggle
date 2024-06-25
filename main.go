package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

var (
	dataStore = make(map[string]DataItem)
	mu        sync.Mutex
)

type DataItem struct {
	Value   interface{} `json:"value"`
	Updated int64       `json:"updated"`
}

func main() {
	var PORT = 8080
	http.HandleFunc("/set", setterHandler)
	http.HandleFunc("/get", getterHandler)
	fmt.Printf("Server is listening on port %d...", PORT)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", PORT), nil))
}

func setterHandler(w http.ResponseWriter, r *http.Request) {
	updatedTime := time.Now().UnixMicro()
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
		if prevData, exists := dataStore[key]; !exists || prevData.Updated < updatedTime {
			dataStore[key] = DataItem{
				Value:   value,
				Updated: updatedTime,
			}
		}
	}
	mu.Unlock()

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Data stored successfully")
}

func getterHandler(w http.ResponseWriter, r *http.Request) {
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
