const downloadButton = document.getElementById("download");
const downloadLink = document.getElementById("downloadLink");
downloadButton.onclick = createCSVs;

var chartsByName = {};
const file_data = {};
function createChart(name, numbers) {
  console.log("creating chart");
  const container = document.getElementById("graphableNumbersContainer");
  const chartDiv = document.createElement("div");
  chartDiv.className = "chart-container";
  chartDiv.id = "chart_" + name.replace(/\s+/g, "_");
  container.appendChild(chartDiv);

  const labels = Array.from({ length: numbers.length }, (_, i) => i);
  const data = [labels, numbers];

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

  const chart = new uPlot(options, data, chartDiv);

  chartsByName[name] = {
    chart: chart,
    data: data,
  };
  file_data[name] = {
    values: numbers,
    timestamps: labels,
  };
  const dataDownloadLink = document.createElement("a");
  dataDownloadLink.innerHTML = "Download " + name + " data as csv";
  dataDownloadLink.setAttribute("download", name + ".csv");
  dataDownloadLink.setAttribute(
    "href",
    "data:application/octet-stream," +
      encodeURI(chartToCSVString(file_data[name]))
  );
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

  data[0] = data[0].concat(newLabels);
  data[1] = data[1].concat(numbers);

  file_data[name]["timestamps"] = data[0];
  file_data[name]["values"] = data[1];
  // Keep data size manageable
  // const maxPoints = 5000;
  // if (data[0].length > maxPoints) {
  //   data[0] = data[0].slice(-maxPoints);
  //   data[1] = data[1].slice(-maxPoints);
  // }

  chart.setData(data);
}

async function addDataToGraph(name, numbers) {
  if (!Array.isArray(numbers)) {
    console.error("Expected an array of numbers");
    return;
  }

  if (!chartsByName[name]) {
    createChart(name, numbers);
  } else {
    updateChart(name, numbers);
  }
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
// Consider appending a div that contains the graph and a link to the corresponding data. Update the URI upon call to batchAddPoints

setInterval(() => {
  for (const chartName in chartsByName) {
    const { uplot } = chartsByName[chartName];
    uplot.redraw(); // Ensures smooth rendering
  }
}, 300);
