/**
 * Moves the robot icon to the specified (x, y) coordinates on the map. Units is meters
 * @param {number} x - The x-coordinate on the map.
 * @param {number} y - The y-coordinate on the map.
 */
function moveRobotIcon(x, y) {
  let vw = window.innerHeight / 100;
  x = (x / 12) * 60 * vw;
  y = (y / 8) * 40 * vw;
  const userIcon = document.getElementById("robot-icon");

  const iconWidth = userIcon.offsetWidth;
  const iconHeight = userIcon.offsetHeight;

  const adjustedX = x - iconWidth / 2;
  const adjustedY = y - iconHeight / 2;

  userIcon.style.left = adjustedX + "px";
  userIcon.style.top = adjustedY + "px";
}
