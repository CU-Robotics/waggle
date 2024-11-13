var currentFolder = "/home"

document.addEventListener("DOMContentLoaded", () => {
  getFolder(currentFolder)
  const backButton = document.getElementById("back-button")
  backButton.addEventListener("click", back)
});

function getFolder(folderPath) {
  var url = "http://localhost:3000/get-folder";
  const explorerContainer = document.getElementById("explorer-container")
  // Clears out any previous getFolder requests from DOM
  explorerContainer.innerHTML = ''
  const notepadContainer = document.getElementById("notepad-container")
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ folderPath: folderPath }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
   }).then((data) => {
      return data.item
    })
    .then((data) => {
      var color = true
      for (let i = 0; i < data.length; i++) {
        var fileContainer = document.createElement("div")
        fileContainer.classList.add("fileContainer")
        fileContainer.id = data[i].filename
        // Creates alternating colors
        if (color == true)
          fileContainer.style.backgroundColor = "silver"
        else 
          fileContainer.style.backgroundColor = "whiteSmoke"
        color = !color
        
        if (data[i].isdir) {
          var dirIcon = document.createElement("img")
          dirIcon.src = "./folder.png" 
          dirIcon.style.marginRight = "8px"
          fileContainer.classList.add("folder")
          fileContainer.appendChild(dirIcon)
        }
        // Adds the fileName to the fileContainer
        fileContainer.appendChild(document.createTextNode(data[i].filename))
        fileContainer.addEventListener("click", handleClick)
        // Add the file container to the explorerContainer
        explorerContainer.appendChild(fileContainer)

      }
    })
    .catch((error) => {
      console.error(error);
    });
}

function handleClick(event) {
  var src = event.srcElement
  if (src.classList.contains("folder")) {
    currentFolder = currentFolder + "/" + src.id
    getFolder(currentFolder)
  }
  else {
    console.log("You clicked a file!")
  }
}

function back() {
  pathArray = currentFolder.split("/")
  currentFolder = ""
  // Reconstructs path without the last part of the path
  for (let i = 0; i < pathArray.length -1; i++) {
    currentFolder += "/" + pathArray[i]
  }
  getFolder(currentFolder)
}