document.addEventListener("DOMContentLoaded", () => {
  const messagesDiv = document.getElementById("messages");
  let socket;
  const wsUrl = `ws://${window.location.host}/ws`;

  const openSocket = () => {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connection established");
    };

    socket.onmessage = (event) => {
      const messageDiv = document.createElement("div");
      event.data;

      let data = JSON.parse(event.data);
      if (!("type" in data)) {
        return;
      }
      if (data.type == "robot_position") {
        moveRobotIcon(data.data.x, data.data.y);
      }
      // messageDiv.className = "message";
      // messageDiv.textContent = event.data;
      // messagesDiv.insertBefore(
      //     messageDiv,
      //     messagesDiv.firstChild,
      // );
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
