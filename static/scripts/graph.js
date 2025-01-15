var chartsByName = {};
const file_data = [];
document.addEventListener("");
async function addDataToGraph(name, number) {
  if (!chartsByName[name]) {
    // chart no exist lol
    var container = document.getElementById("graphableNumbersContainer");
    var canvas = document.createElement("canvas");
    canvas.height = 50;
    canvas.id = "chart_" + name.replace(/\s+/g, "_");
    container.appendChild(canvas);

    var ctx = canvas.getContext("2d");
    var chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [0],
        datasets: [
          {
            label: name,
            data: [number],
            fill: false,
            borderColor: "rgba(75, 192, 192, 1)",
            tension: 0.1,
          },
        ],
      },
      options: {
        animation: false,
        scales: {
          x: {
            title: {
              display: true,
              text: "Data Point Index",
            },
          },
          y: {
            title: {
              display: true,
              text: "Value",
            },
          },
        },
      },
    });
    chartsByName[name] = {
      chart: chart,
      dataIndex: 1,
    };
    file_data.push({
      name: name,
      values: [],
      indices: [],
    });
  } else {
    var chartObj = chartsByName[name];
    var chart = chartObj.chart;
    var index = chartObj.dataIndex;

    chart.data.labels.push(index);
    chart.data.datasets[0].data.push(number);
    file_data[name]["indices"].push(index);
    file_data[name]["values"].push(number);

    if (chart.data.labels.length > 1000) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }

    // chart.update();
    chartObj.dataIndex += 1;
  }
}

function downloadCSVs() {
  print(createCSVString("yaw"));
  for (chartName in chartsByName) {
    print(chartName);
  }
}

function createCSVString(name) {
  CSVString = "index,value\n";
  for (var i = 0; i < file_data[name]["values"].length; i++) {
    CSVString +=
      file_data[name]["indices"][i] + "," + file_data[name]["values"][i] + "\n";
  }
  return CSVString;
}

randomYaw = 0;

setInterval(() => {
  for (chartName in chartsByName) {
    chartsByName[chartName].chart.update();
  }
}, 50);
