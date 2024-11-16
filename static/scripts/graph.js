var chartsByName = {};
async function addDataToGraph(name, numbers) {
  if (!Array.isArray(numbers)) {
    console.error("Expected an array of numbers");
    return;
  }

  if (!chartsByName[name]) {
    var container = document.getElementById("graphableNumbersContainer");
    var canvas = document.createElement("canvas");
    canvas.height = 50;
    canvas.id = "chart_" + name.replace(/\s+/g, "_");
    container.appendChild(canvas);

    var ctx = canvas.getContext("2d");
    var chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: Array.from({ length: numbers.length }, (_, i) => i),
        datasets: [
          {
            label: name,
            data: numbers,
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
      dataIndex: numbers.length,
    };
  } else {
    var chartObj = chartsByName[name];
    var chart = chartObj.chart;
    var startIndex = chartObj.dataIndex;

    // Add new data points to the chart
    numbers.forEach((number, i) => {
      chart.data.labels.push(startIndex + i);
      chart.data.datasets[0].data.push(number);
    });

    if (chart.data.labels.length > 5000) {
      chart.data.labels = chart.data.labels.slice(-5000);
      chart.data.datasets[0].data = chart.data.datasets[0].data.slice(-5000);
    }
    

    // Update the chart's data index
    chartObj.dataIndex += numbers.length;

    // Refresh the chart
    chart.update();
  }
}



async function batchAddPoints(graphBatch) {
  for (const graphName in graphBatch) {
    points = graphBatch[graphName];
    // addDataToGraph(graphName, points)
  }
}

randomYaw = 0;


setInterval(()=>{
  for (chartName in chartsByName){
    chartsByName[chartName].chart.update();
  }
}, 300)
