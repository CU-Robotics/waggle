// reqCounter = 0;
// let startTime = Date.now()
// document.addEventListener("DOMContentLoaded", () => {
//   const messagesDiv = document.getElementById("messages");
//   let socket;
//   let lastTimeStamp = 0;
//   const wsUrl = `ws://${window.location.host}/ws`;

//   const openSocket = () => {
//     socket = new WebSocket(wsUrl);

//     socket.onopen = () => {
//       console.log("WebSocket connection established");
//       socket.bufferedAmount = 0;
//     };

//     socket.onmessage =  (event) => {
//       reqCounter += 1;
//       // console.log(reqCounter / (Date.now() - startTime)*1000, ` it/s`)
//       let data = JSON.parse(event.data);
//       if (data.timestamp < lastTimeStamp) {
//         return;
//       }
//       lastTimeStamp = data.timestamp;
//       if (!("type" in data)) {
//         console.log("Mising Type");
//         return;
//       }

//       if (data.type == "set_robot_position") {
//         moveRobotIcon(data.data.x, data.data.y);
//       } else if (data.type == "graph_number") {
//         addDataToGraph(data.data.graphName, data.data.value);
//       } else if (data.type == "display_cv_mat") {
//         updateOrCreateImage(
//           data.data.matName,
//           data.data.base64,
//           data.data.flip
//         );
//         console.log(data.data.flip);
//       } else if (data.type == "batch") {
//         for (const k in data.data["cv-mats"]) {
//           updateOrCreateImage(k, data.data["cv-mats"][k], false);
//         }

//         // for(var point of data.data['graphable-numbers']){
//         //   addDataToGraph(point.graphName, point.value);
//         // }
//         batchAddPoints(data.data["graphable-numbers"]);
//       } else {
//         console.log(data);
//         console.log(data.type);
//       }
//     };

//     socket.onerror = (error) => {
//       console.error("WebSocket error:", error);
//     };

//     socket.onclose = () => {
//       console.log("WebSocket connection closed");
//       setTimeout(openSocket, 500); // Try to reopen after 5 seconds
//     };
//   };

//   openSocket();
// });
let peerConnection;
let dataChannel;

async function startWebRTC() {
    peerConnection = new RTCPeerConnection();

    peerConnection.ondatachannel = (event) => {
      console.log("📡 Received DataChannel", event.channel);
      dataChannel = event.channel;
  
      dataChannel.onmessage = (event) => {
          const receivedData = JSON.parse(event.data);
          console.log("📩 WebRTC Received:", receivedData);
  
          if (receivedData.type === "graph_number") {
              console.log(`📊 Graph Update: ${receivedData.data.graphName} = ${receivedData.data.value}`);
          } else if (receivedData.type === "set_robot_position") {
              console.log(`🤖 Robot moved to X: ${receivedData.data.x}, Y: ${receivedData.data.y}`);
          } else if (receivedData.type === "display_cv_mat") {
              console.log(`📸 Image Received: ${receivedData.data.matName}`);
          }
      };
  };
  
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("❄️ ICE candidate:", event.candidate);
        } else {
            console.log("✅ ICE gathering complete.");
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log("🚦 Peer connection state:", peerConnection.connectionState);
    };

    peerConnection.onsignalingstatechange = () => {
        console.log("🔁 Signaling state:", peerConnection.signalingState);
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const response = await fetch("/webrtc-signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offer),
    });

    const answer = await response.json();
    await peerConnection.setRemoteDescription(answer);
}

// function sendMessage(message) {
//     if (dataChannel && dataChannel.readyState === "open") {
//         console.log("🚀 Sending message:", message);
//         dataChannel.send(message);
//     } else {
//         console.warn("❌ DataChannel not open. Message not sent.");
//     }
// }

startWebRTC();
