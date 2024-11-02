async function updateOrCreateImage(matName, base64) {
    const container = document.getElementById('cvMatImagesContainer');
  
    if (!container) {
      console.error("Container with ID 'cvMatImagesContainer' not found.");
      return;
    }
  
    let imgElement = document.querySelector(`#cvMatImagesContainer img[data-mat-name='${matName}']`);
  
    if (!imgElement) {
      imgElement = document.createElement('img');
      imgElement.setAttribute('data-mat-name', matName);
      imgElement.alt = matName;
      imgElement.classList.add('cvMatImage')
      container.appendChild(imgElement); 
    }
  
    imgElement.src = `data:image/png;base64,${base64}`;
  }

  