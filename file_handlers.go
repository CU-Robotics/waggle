package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func expandPath(path string) (string, error) {
	if path[:2] == "~/" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(homeDir, path[2:]), nil
	}
	return path, nil
}

type FSItem struct {
	FileName string `json:"filename"`
	IsDir    bool   `json:"isdir"`
}
type FolderResponse struct {
	Items []FSItem `json:"item"`
}
type FolderRequest struct {
	FolderPath string `json:"folderPath"`
}

func getFolderHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	println('1')
	var data FolderRequest
	err = json.Unmarshal(body, &data)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	log.Println("Getting folder")

	expandedPath, err := expandPath(data.FolderPath)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	entries, err := os.ReadDir(expandedPath)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println("entries")
		log.Println(err)
		return
	}

	numFiles := len(entries)
	response := FolderResponse{Items: make([]FSItem, numFiles)}
	for i := 0; i < numFiles; i++ {
		response.Items[i] = FSItem{
			FileName: entries[i].Name(),
			IsDir:    entries[i].IsDir(),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)

}
