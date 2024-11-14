var currentFolder = "/home"
var currentFile = ""


document.addEventListener("DOMContentLoaded", () => {
  getFolder(currentFolder)
  // Make back button work
  const backButton = document.getElementById("back-button")
  backButton.addEventListener("click", back)
  // Make submit button work
  const submitFile = document.getElementById("submit-file")
  submitFile.addEventListener("submit", fileSubmitHandler)
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
        fileContainer.addEventListener("click", fileClickHandler)
        // Add the file container to the explorerContainer
        explorerContainer.appendChild(fileContainer)

      }
    })
    .catch((error) => {
      console.error(error);
    });
}

function fileClickHandler(event) {
  var src = event.srcElement
  if (src.classList.contains("folder")) {
    currentFolder = currentFolder + "/" + src.id
    getFolder(currentFolder)
  }
  else {
    console.log("clicked file")
    loadFile(currentFolder + "/" + src.id)
    const submitFile = document.getElementById("submit-file")
    submitFile.value = "Update: " + currentFolder + "/" + src.id
    currentFile = src.id
  }
}

function loadFile(filePath) {
  const notepadText = document.getElementById("notepad-text")
  notepadText.innerHTML = ''
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
    var fileContents = atob(data.data)
    notepadText.value = fileContents
  })
}

function fileSubmitHandler() {
  const textElement = document.getElementById("notepad-text")

  var text = textElement.value
  console.log(text)
  url = "http://localhost:3000/put-file"
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ "data": btoa(text), "filePath": filePath + "/" + currentFile})
  }).then((response) => {
    console.log(response)
  })


}

function backClickHandler() {
  pathArray = currentFolder.split("/")
  currentFolder = ""
  // Reconstructs path without the last part of the path
  for (let i = 0; i < pathArray.length -1; i++) {
    currentFolder += "/" + pathArray[i]
  }
  getFolder(currentFolder)
}

