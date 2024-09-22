document.addEventListener("DOMContentLoaded", () => {
  const messagesDiv = document.getElementById("messages");
  let socket;
  let lastTimeStamp = 0;
  const wsUrl = `ws://${window.location.host}/ws`;

  const openSocket = () => {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connection established");
    };

    socket.onmessage = (event) => {
      let data = JSON.parse(event.data);
      console.log(data);
      if(data.timestamp < lastTimeStamp){
        return;
      }
      lastTimeStamp = data.timestamp;
      if (!("type" in data)) {
        return;
      }
      
      if (data.type == "set_robot_position") {
        moveRobotIcon(data.data.x, data.data.y);
      } else if (data.type == "graph_number") {
        addDataToGraph(data.data.graphName, data.data.value);
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
