reqCounter = 0;
document.addEventListener("DOMContentLoaded", () => {
  const messagesDiv = document.getElementById("messages");
  let socket;
  let lastTimeStamp = 0;
  const wsUrl = `ws://${window.location.host}/ws`;

  const openSocket = () => {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connection established");
      socket.bufferedAmount = 0;
    };

    socket.onmessage = async (event) => {
      reqCounter += 1;
      let data = JSON.parse(event.data);
      if (data.timestamp < lastTimeStamp) {
        return;
      }
      lastTimeStamp = data.timestamp;
      if (!("type" in data)) {
        console.log("Mising Type");
        return;
      }

      if (data.type == "set_robot_position") {
        moveRobotIcon(data.data.x, data.data.y);
      } else if (data.type == "graph_number") {
        addDataToGraph(data.data.graphName, data.data.value);
      } else if (data.type == "display_cv_mat") {
        updateOrCreateImage(
          data.data.matName,
          data.data.base64,
          data.data.flip
        );
        console.log(data.data.flip);
      } else if (data.type == "batch") {
        for (const k in data.data["cv-mats"]) {
          updateOrCreateImage(k, data.data["cv-mats"][k], false);
        }

        // for(var point of data.data['graphable-numbers']){
        //   addDataToGraph(point.graphName, point.value);
        // }
        batchAddPoints(data.data["graphable-numbers"]);
      } else {
        console.log(data);
        console.log(data.type);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setTimeout(openSocket, 500); // Try to reopen after 5 seconds
    };
  };

  openSocket();
});
