var chartsByName = {};
const file_data = {};
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

function updateChart(name, numbers) {
  console.log("updating chart");
  const chartObj = chartsByName[name];
  const chart = chartObj.chart;
  const data = chartObj.data;

  const startIndex = data[0].length;
  const newLabels = Array.from(
    { length: numbers.length },
    (_, i) => startIndex + i
  );

  chart.setData(chartsByName[name]["data"]);
}

async function addDataToGraph(name, numbers) {
  if (!Array.isArray(numbers)) {
    console.error("Expected an array of numbers");
    return;
  }

  // Handle creating necessary objs for new charts/data
  var newChart = false;
  if (!file_data[name]) {
    file_data[name] = {
      values: [],
      timestamps: [],
    };
    chartsByName[name] = {
      chart: null,
      data: null,
    };
    createChart(name, numbers);
  }
  // Append new data to old data
  file_data[name]["values"] = file_data[name]["values"].concat(numbers);
  for (var i = 1; i <= numbers.length; i++) {
    file_data[name]["timestamps"].push(
      file_data[name]["timestamps"].length + i
    );
  }
  chartsByName[name]["data"] = [
    file_data[name]["timestamps"],
    file_data[name]["values"],
  ];

  // Update the chart
  chartsByName[name]["chart"].setData(chartsByName[name]["data"]);

  // Update the download link
  const dataDownloadLink = document.getElementById("download_" + name);
  dataDownloadLink.setAttribute(
    "href",
    "data:application/octet-stream," +
      encodeURI(chartToCSVString(file_data[name]))
  );
}
async function batchAddPoints(graphBatch) {
  for (const graphName in graphBatch) {
    const points = graphBatch[graphName];
    addDataToGraph(graphName, points);
  }
}

function chartToCSVString(data) {
  CSVString = "timestamp,values\n";
  for (var i = 0; i < data["values"].length; i++) {
    CSVString += data["timestamps"][i] + "," + data["values"][i] + "\n";
  }
  return CSVString;
}
function createCSVs() {
  for (graphData in file_data) {
    CSVString = chartToCSVString(file_data[graphData]);
    downloadLink.setAttribute(
      "href",
      "data:application/octet-stream," + encodeURI(CSVString)
    );
  }
}

setInterval(() => {
  for (const chartName in chartsByName) {
    const { uplot } = chartsByName[chartName];
    uplot.redraw(); // Ensures smooth rendering
  }
}, 300);
