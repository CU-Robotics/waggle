var currentFolder = "~/";
var currentFile = "";
var baseUrl = window.location.href
document.addEventListener("DOMContentLoaded", () => {
  // Load the home directory on DOM load
  getFolder(currentFolder);
  // Make back button work
  const backButton = document.getElementById("back-button");
  backButton.addEventListener("click", backClickHandler);
  // Make submit button work
  const submitFile = document.getElementById("submit-file");
  submitFile.addEventListener("click", fileSubmitHandler);
});

function getFolder(folderPath) {
  const explorerContainer = document.getElementById("file-explorer");
  // Clears out any previous getFolder requests from DOM
  explorerContainer.innerHTML = "";
  var url = "/get-folder";
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ folderPath: folderPath }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      return response.json();
    })
    .then((data) => {
      return data.item;
    })
    .then((data) => {
      var color = true;
      for (let i = 0; i < data.length; i++) {
        var fileContainer = document.createElement("div");
        fileContainer.classList.add("fileContainer");
        fileContainer.id = data[i].filename;
        // Creates alternating colors
        if (color == true) fileContainer.style.backgroundColor = "silver";
        else fileContainer.style.backgroundColor = "whiteSmoke";
        color = !color;
        // Add the file icon if it is a file
        if (data[i].isdir) {
          var dirIcon = document.createElement("img");
          dirIcon.src = "./folder.png";
          dirIcon.style.marginRight = "8px";
          fileContainer.classList.add("folder");
          fileContainer.appendChild(dirIcon);
        }
        // Adds the fileName to the fileContainer
        fileContainer.appendChild(document.createTextNode(data[i].filename));
        fileContainer.addEventListener("click", fileClickHandler);
        // Add the file container to the explorerContainer
        explorerContainer.appendChild(fileContainer);
      }
    })
    .catch((error) => {
      console.error(error);
    });
}

function fileClickHandler(event) {
  var src = event.srcElement;
  // If what is clicked is a folder, load that folder and update currentFolder
  if (src.classList.contains("folder")) {
    currentFolder = currentFolder + "/" + src.id;
    getFolder(currentFolder);
  }
  // If what is clicked is a file, load that file and update currentFile
  else {
    currentFile = currentFolder + "/" + src.id;
    loadFile(currentFile);
    // Changes look of button for updating files
    const submitFile = document.getElementById("submit-file");
    submitFile.innerHTML = "";
    submitFile.appendChild(document.createTextNode("Update " + currentFile));
  }
}

function loadFile(filePath) {
  // Erase content of notepad
  const notepadText = document.getElementById("notepad-text");
  notepadText.innerHTML = "";
  url = "/get-file";
  console.log("Loading: ", filePath);
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filePath: filePath }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      return response.json();
    })
    .then((data) => {
      // Convert from base64 to text and put that into
      var fileContents = atob(data.data);
      notepadText.value = fileContents;
    });
}

function fileSubmitHandler() {
  const textElement = document.getElementById("notepad-text");

  var text = textElement.value;
  url = "/put-file";
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Converts data to base64
      data: btoa(text),
      filePath: currentFile,
    }),
  }).then((response) => {
    if (!response.ok) {
      document.getElementById("form-result");
      document.innerHTML = response.statusText;
      throw new Error(response.statusText);
    }
  });
}

function backClickHandler() {
  currentFolder = getParentDirectory(currentFolder);
  console.log(currentFolder);
  getFolder(currentFolder);
}

function getParentDirectory(path) {
  let isHomePath = false;
  if (path.startsWith("~")) {
    isHomePath = true;
  }

  let normalizedPath = path;
  if (path.endsWith("/")) {
    normalizedPath = path.slice(0, -1);
  }

  const pathParts = normalizedPath.split("/");

  pathParts.pop();

  let parentDirectory = pathParts.join("/");
  if (isHomePath && parentDirectory !== "") {
    parentDirectory = "~/" + parentDirectory.slice(2);
  } else if (isHomePath) {
    parentDirectory = "~";
  }

  if (parentDirectory == "" || parentDirectory == "~") {
    parentDirectory = "~/";
  }

  return parentDirectory;
}
function binaryToText(binaryString) {
  // Ensure binary string is a multiple of 8
  let text = "";
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
