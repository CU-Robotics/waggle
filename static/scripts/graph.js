var chartsByName = {};
var originalGraphDisplay;
var graphsEnabled = true;

document.addEventListener("DOMContentLoaded", () => {
  originalGraphDisplay = document.getElementById("graphableNumbersContainer")
    .style.display;

  document
    .getElementById("toggle-graphs")
    .addEventListener("input", toggleGraphs);
});

function toggleGraphs() {
  const toggleGraphsCheck = document.getElementById("toggle-graphs");
  const graphsContainer = document.getElementById("graphableNumbersContainer");

  if (toggleGraphsCheck.checked) {
    graphsContainer.style.display = originalGraphDisplay;
  } else {
    graphsContainer.style.display = "none";
  }
}

function createChart(name) {
  const container = document.getElementById("graphableNumbersContainer");
  const chartDiv = document.createElement("div");
  chartDiv.className = "chart-container";
  chartDiv.id = "chart_" + name.replace(/\s+/g, "_");
  container.appendChild(chartDiv);

  const options = {
    width: window.innerWidth * 0.95,
    height: 300,
    title: name,
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
  chartsByName[name]["chart"] = chart;

  const dataDownloadLink = document.createElement("a");
  dataDownloadLink.innerHTML = "Download " + name + " data as csv";
  dataDownloadLink.setAttribute("download", name + ".csv");
  dataDownloadLink.id = "download_" + name;
  chartDiv.appendChild(dataDownloadLink);
}

async function addDataToGraph(name, numbers) {
  if (!Array.isArray(numbers)) {
    console.error("Expected an array of numbers");
    return;
  }

  // Handle creating necessary objs for new charts/data
  var newChart = false;
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
  chartsByName[name]["chart"].setData(chartsByName[name]["data"]);

  // Update the download link
  const dataDownloadLink = document.getElementById("download_" + name);
  dataDownloadLink.setAttribute(
    "href",
    "data:application/octet-stream," +
      encodeURI(chartToCSVString(chartsByName[name]["data"]))
  );
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

setInterval(() => {
  for (const chartName in chartsByName) {
    const { uplot } = chartsByName[chartName];
    uplot.redraw(); // Ensures smooth rendering
  }
}, 300);
