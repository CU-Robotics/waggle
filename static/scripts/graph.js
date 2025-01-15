var chartsByName = {};

function createChart(name, numbers) {
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

setInterval(() => {
  for (const chartName in chartsByName) {
    const { uplot } = chartsByName[chartName];
    uplot.redraw(); // Ensures smooth rendering
  }
}, 300);
