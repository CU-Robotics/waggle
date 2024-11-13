var folderPath = "~/Desktop";
var url = "http://localhost:3000/get-folder";

console.log("Making request to url:", url);
console.log("Requesting folder:", folderPath);
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
    console.log(data);
  })
  .catch((error) => {
    console.error(error);
  });

console.log("Made request");

// // fetch("http://")

// const request = new XMLHttpRequest();
// request.open("GET", url);
// request.setRequestHeader("Content-Type", "application/json");
// request.send(JSON.stringify(data));

// request.onreadystatechange = () => {
//     if (request.readyState === XMLHttpRequest.DONE) {
//         if (request.status === 200) {
//             console.log("Success:", request.responseText);
//         } else {
//             console.log("Error:", request.status, request.statusText);
//         }
//     }
// }
