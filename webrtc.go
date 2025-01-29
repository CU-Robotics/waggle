package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/pion/webrtc/v4"
)

type PeerConnection struct {
	Connection  *webrtc.PeerConnection
	DataChannel *webrtc.DataChannel
}

var peers = make(map[string]*PeerConnection)
var peersMutex = &sync.Mutex{}

func webrtcSignalHandler(w http.ResponseWriter, r *http.Request) {
	var offer webrtc.SessionDescription
	err := json.NewDecoder(r.Body).Decode(&offer)
	if err != nil {
		http.Error(w, "Invalid SDP offer", http.StatusBadRequest)
		return
	}

	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		http.Error(w, "Failed to create PeerConnection", http.StatusInternalServerError)
		return
	}

	peerID := fmt.Sprintf("%p", pc)
	peersMutex.Lock()
	peers[peerID] = &PeerConnection{Connection: pc}
	peersMutex.Unlock()

	pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		log.Println("📡 DataChannel received on server:", dc.Label())
		peersMutex.Lock()
		peers[peerID].DataChannel = dc
		peersMutex.Unlock()

		dc.OnOpen(func() {
			log.Println("✅ DataChannel Opened for peer:", peerID)
		})

		dc.OnClose(func() {
			log.Println("❌ DataChannel Closed for peer:", peerID)
			peersMutex.Lock()
			delete(peers, peerID)
			peersMutex.Unlock()
		})

		dc.OnMessage(func(msg webrtc.DataChannelMessage) {
			log.Printf("📩 Received message from %s: %s\n", peerID, string(msg.Data))
			// broadcastMessage(msg.Data)
		})
	})

	err = pc.SetRemoteDescription(offer)
	if err != nil {
		http.Error(w, "Failed to set remote description", http.StatusInternalServerError)
		return
	}

	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		http.Error(w, "Failed to create answer", http.StatusInternalServerError)
		return
	}

	err = pc.SetLocalDescription(answer)
	if err != nil {
		http.Error(w, "Failed to set local description", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answer)
}
func broadcastMessage(data ClientData) {

	message, err := json.Marshal(data)
	if err != nil {
		log.Println("Error marshalling JSON:", err)
		return
	}

	peersMutex.Lock()
	defer peersMutex.Unlock()

	for id, peer := range peers {
		if peer.DataChannel != nil && peer.DataChannel.ReadyState() == webrtc.DataChannelStateOpen {
			err := peer.DataChannel.Send(message)
			if err != nil {
				log.Println("⚠️ Error sending message to peer:", id, err)
			}
		} else {
			log.Println("❌ Skipping peer", id, "because DataChannel is not open")
		}
	}
}
