const imageMap = new Map();

function updateOrCreateImage(matName, base64, flip) {
  // Store base64 data and flip information in the map
  imageMap.set(matName, { base64, flip });
}

// Set an interval to update images every 100 milliseconds
setInterval(() => {
  const container = document.getElementById('cvMatImagesContainer');

  if (!container) {
    console.error("Container with ID 'cvMatImagesContainer' not found.");
    return;
  }

  // Iterate over each entry in the map
  imageMap.forEach(({ base64, flip }, matName) => {
    let imgElement = container.querySelector(`img[data-mat-name='${matName}']`);

    // If the image element does not exist, create it
    if (!imgElement) {
      imgElement = document.createElement('img');
      imgElement.setAttribute('data-mat-name', matName);
      imgElement.alt = matName;
      imgElement.classList.add('cvMatImage');
      container.appendChild(imgElement);
    }

    // Set the flip class based on the flip parameter
    if (flip) {
      imgElement.classList.add('flipImage');
    } else {
      imgElement.classList.remove('flipImage');
    }

    // Update the image source
    imgElement.src = `data:image/png;base64,${base64}`;
  });
  imageMap.clear();
}, 200);