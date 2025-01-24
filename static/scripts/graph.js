var chartsByName = {};
var originalGraphDisplay;
var graphsEnabled = true;
var downloadsEnabled = true;

document.addEventListener("DOMContentLoaded", () => {
  originalGraphDisplay = document.getElementById("graphableNumbersContainer")
    .style.display;

  document
    .getElementById("toggle-graphs")
    .addEventListener("input", toggleGraphs);

  document
    .getElementById("toggle-downloads")
    .addEventListener("input", toggleDownloads);
});

function toggleGraphs() {
  const toggleGraphsCheck = document.getElementById("toggle-graphs");
  if (toggleGraphsCheck.checked) {
    graphsEnabled = true;
    for (const name in chartsByName) {
      chartsByName[name]["chart"].setData(chartsByName[name]["data"]);
    }
    const charts = document.getElementsByClassName("chart-container");
    for (var i = 0; i < charts.length; i++) {
      charts[i].style.display = "block";
    }
  } else {
    const charts = document.getElementsByClassName("chart-container");
    for (var i = 0; i < charts.length; i++) {
      charts[i].style.display = "none";
    }
    graphsEnabled = false;
  }
}

function toggleDownloads() {
  const toggleDownloadsCheck = document.getElementById("toggle-downloads");
  if (toggleDownloadsCheck.checked) {
    downloadsEnabled = true;
    for (const name in chartsByName) {
      const downloadLink = document.getElementById("download-link_" + name);
      downloadLink.style.display = "block";
    }
  } else {
    for (const name in chartsByName) {
      const downloadLink = document.getElementById("download-link_" + name);
      downloadLink.style.display = "none";
      downloadsEnabled = false;
    }
  }
}

function createChart(name) {
  const container = document.getElementById("graphableNumbersContainer");
  // dataContainer contains both download link/button and the chart-container
  const dataContainer = document.createElement("div");
  dataContainer.id = "data_" + name;
  container.appendChild(dataContainer);
  const chartDiv = document.createElement("div");
  chartDiv.className = "chart-container";
  chartDiv.id = "chart_" + name.replace(/\s+/g, "_");
  dataContainer.appendChild(chartDiv);

  const options = {
    width: window.innerWidth * 0.95,
    height: 300,
    title: name,
    labels: ["x", "y"],
    axes: [
      {
        label: "Index",
        scale: "x",
      },
      {
        label: "Value",
      },
    ],
    scales: {
      x: {
        time: false,
        type: "linear",
      },
    },
    series: [
      {},
      {
        stroke: "rgba(75, 192, 192, 1)",
      },
    ],
  };

  const chart = new uPlot(options, chartsByName[name]["data"], chartDiv);
  console.log(chart);

  chartsByName[name]["chart"] = chart;

  // Creates a button with a link wrapping it. Clicking the button causes the URI to be generated via initiateDownload
  const dataDownloadLink = document.createElement("a");
  dataDownloadLink.id = "download-link_" + name;
  const dataDownloadButton = document.createElement("input");
  // Configure the button
  dataDownloadButton.value = "Download " + name + ".csv";
  dataDownloadButton.setAttribute("download", name + ".csv");
  dataDownloadButton.type = "button";
  dataDownloadButton.id = "download-button_" + name;
  dataDownloadButton.addEventListener("mouseup", initiateDownload);
  // Add link & button to DOM
  document.getElementById("data_" + name).appendChild(dataDownloadLink);
  dataDownloadLink.appendChild(dataDownloadButton);

  setInterval(() => {
    if (graphsEnabled) {
      let startIndex = chartsByName[name]["data"][0].length - 1000;
      let endIndex = chartsByName[name]["data"][0].length;
      if (startIndex <= 0) {
        chartsByName[name]["chart"].setData(chartsByName[name]["data"]);
        return;
      }
      let data = [
        chartsByName[name]["data"][0].slice(startIndex, endIndex),
        chartsByName[name]["data"][1].slice(startIndex, endIndex),
      ];
      chartsByName[name]["chart"].setData(data);
    }
  }, 100);
}

function initiateDownload(event) {
  // Extract the name of the data and get the associated download link
  const name = event.srcElement.id.substring(16);
  const downloadLink = document.getElementById("download-link_" + name);
  // Generate a link based off of the associated CSV string
  downloadLink.setAttribute(
    "href",
    "data:application/octet-stream," +
      encodeURI(chartToCSVString(chartsByName[name]["data"]))
  );
  // Set the download name
  downloadLink.setAttribute("download", name + ".csv");
}

async function addDataToGraph(name, numbers) {
  if (!Array.isArray(numbers)) {
    console.error("Expected an array of numbers");
    return;
  }

  // Handle creating necessary objs for new charts/data
  if (!chartsByName[name]) {
    chartsByName[name] = {
      chart: null,
      data: [[], []],
    };
    createChart(name, numbers);
  }
  // Append new data to old data
  chartsByName[name]["data"][1] = chartsByName[name]["data"][1].concat(numbers);
  var originalLength = chartsByName[name]["data"][0].length;
  for (var i = 1; i <= numbers.length; i++) {
    chartsByName[name]["data"][0].push(originalLength + i);
  }
  // Update the chart
}
async function batchAddPoints(graphBatch) {
  for (const graphName in graphBatch) {
    const points = graphBatch[graphName];
    addDataToGraph(graphName, points);
  }
}

function chartToCSVString(data) {
  // Create header
  CSVString = "timestamp,values\n";
  // Append each row of data
  for (var i = 0; i < data[0].length; i++) {
    CSVString += data[0][i] + "," + data[1][i] + "\n";
  }
  return CSVString;
}
