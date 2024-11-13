var currentFolder = "/home"


document.addEventListener("DOMContentLoaded", () => {
  getFolder(currentFolder)
  const backButton = document.getElementById("back-button")
  backButton.addEventListener("click", back)
});

function getFolder(folderPath) {
  const explorerContainer = document.getElementById("explorer-container")
  var url = "http://localhost:3000/get-folder";
  // Clears out any previous getFolder requests from DOM
  explorerContainer.innerHTML = ''
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
    console.log("clicked file")
    loadFile(currentFolder + "/" + src.id)
  }
}

function loadFile(filePath) {
  const notepadContainer = document.getElementById("notepad-container")
  url = "http://localhost:3000/get-file"
  console.log("Loading: ", filePath)
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filePath: filePath }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
  }).then((data) => {
    notepadContainer.innerHTML = ''
    var fileContents = atob(data.data)
    console.log(fileContents)
    notepadContainer.appendChild(document.createTextNode(fileContents))
  })
  
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

function binaryToText(binaryString) {
  // Ensure binary string is a multiple of 8
  let text = '';
  for (let i = 0; i < binaryString.length; i += 8) {
    // Extract an 8-bit chunk (byte)
    let byte = binaryString.substring(i, i + 8);
    // Convert the binary string to a decimal number
    let charCode = parseInt(byte, 2);
    // Convert the character code to a character and append to the text
    text += String.fromCharCode(charCode);
  }
  return text;
}