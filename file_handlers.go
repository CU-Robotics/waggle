package main

import (
	"bufio"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
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

type FileSystemItem struct {
	FileName string `json:"filename"`
	IsDir    bool   `json:"isdir"`
}
type FolderResponse struct {
	Items []FileSystemItem `json:"item"`
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
	response := FolderResponse{Items: make([]FileSystemItem, numFiles)}
	for i := 0; i < numFiles; i++ {
		response.Items[i] = FileSystemItem{
			FileName: entries[i].Name(),
			IsDir:    entries[i].IsDir(),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

type FileRequest struct {
	FilePath string `json:"filePath"`
}
type FileData struct {
	Data []byte `json:"data"`
}

func getFileHandler(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	var data FileRequest
	err = json.Unmarshal(body, &data)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	path, err := expandPath(data.FilePath)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	file, err := os.Open(path)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}
	defer file.Close()

	fileMetaData, err := file.Stat()
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	fileSize := fileMetaData.Size()

	reader := bufio.NewReader(file)
	resData := make([]byte, fileSize)
	var curIndex int64 = 0

	for curIndex < fileSize {
		n, err := reader.Read(resData[curIndex:])
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			log.Println(err)
			return
		}

		curIndex += int64(n)

	}

	response := FileData{Data: make([]byte, fileSize)}
	copy(response.Data, resData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

type FilePutRequest struct {
	FilePath string `json:"filePath"`
	Data     []byte `json:"data"`
}

func putFileHandler(w http.ResponseWriter, r *http.Request) {
	log.Println()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	var data FilePutRequest
	err = json.Unmarshal(body, &data)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	filePath, err := expandPath(data.FilePath)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	file, err := os.Create(filePath)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}
	defer file.Close()

	numberOfBytesWritten, err := file.Write(data.Data)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}
	log.Println("Wrote " + strconv.Itoa(numberOfBytesWritten) + " bytes to " + filePath)

	w.WriteHeader(http.StatusOK)
}
