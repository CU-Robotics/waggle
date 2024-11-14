var chartsByName = {};
async function addDataToGraph(name, number) {
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
  } else {
    var chartObj = chartsByName[name];
    var chart = chartObj.chart;
    var index = chartObj.dataIndex;
    
    chart.data.labels.push(index);
    chart.data.datasets[0].data.push(number);
    
    if (chart.data.labels.length > 10000) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    
    // chart.update();
    chartObj.dataIndex += 1;
  }
}

randomYaw = 0;


setInterval(()=>{
  for (chartName in chartsByName){
    chartsByName[chartName].chart.update();
  }
}, 100)
