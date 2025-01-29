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
  dataDownloadLink.id = "download_" + name;
  chartDiv.appendChild(dataDownloadLink);
}

function updateChart(name, numbers) {
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
  // Could optimize memory here by getting rid of need to put the data into the file_data object. Could also have it return the data object
  file_data[name]["timestamps"] = data[0];
  file_data[name]["values"] = data[1];
  // Keep data size manageable
  // const maxPoints = 5000;
  // if (data[0].length > maxPoints) {
  //   data[0] = data[0].slice(-maxPoints);
  //   data[1] = data[1].slice(-maxPoints);
  // }

  // chart.setData(data);
}

function addDataToGraph(name, numbers) {
  if (!Array.isArray(numbers)) {
    console.error("Expected an array of numbers");
    return;
  }

  if (!chartsByName[name]) {
    createChart(name, numbers);
  } else {
    updateChart(name, numbers);
  }
  // Consider making a seperate button/link that causes the present data to load into the link. Currently it must generate a CSV string upon every update and create a corresponding URI. May murder performance
  const dataDownloadLink = document.getElementById("download_" + name);
  dataDownloadLink.setAttribute(
    "href",
    "data:application/octet-stream," +
      encodeURI(chartToCSVString(file_data[name]))
  );
}
function batchAddPoints(graphBatch) {
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
    const chartObj = chartsByName[chartName];
    const chart = chartObj.chart;
    const data = chartObj.data;

    chart.setData(data);
    // console.log(chartName)
  }
}, 100);
