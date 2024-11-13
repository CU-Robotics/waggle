
var folderPath = "/etc"
// var url = "http://localhost:3000/getFolder?folderPath=" + folderPath
var url = "http://localhost:3000/getFolder?folderPath=/etc"

console.log("Making request: ", url)


fetch(url, {mode: "no-cors"}).then((res) => {
    console.log(res)
}).catch((err) => {
    console.log(err)
})
fetch(url).then((res) => {
    console.log(res)
}).catch((err) => {
    console.log(err)
})
console.log("Made request")

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

