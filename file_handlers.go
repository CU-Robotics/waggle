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

	f, err := os.Open(path)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	fileMetaData, err := f.Stat()
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	fsize := fileMetaData.Size()

	reader := bufio.NewReader(f)
	resData := make([]byte, fsize)
	var curIndex int64 = 0

	for curIndex < fsize {
		n, err := reader.Read(resData[curIndex:])
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			log.Println(err)
			return
		}

		curIndex += int64(n)

	}

	response := FileData{Data: make([]byte, fsize)}
	copy(response.Data, resData)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}


type FilePutRequest struct {
	FilePath string `json:"filePath"`
	Data []byte `json:"data"`
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

	f, err := os.Create(filePath)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}

	n, err := f.Write(data.Data)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Println(err)
		return
	}
	log.Println("Wrote " + strconv.Itoa(n) + " bytes to " + filePath)
	f.Close()



	w.WriteHeader(http.StatusOK)
}