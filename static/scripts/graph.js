// Get the canvas context
const ctx = document.getElementById("myChart").getContext("2d");

// Create the chart
const chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [], // X-axis labels (e.g., timestamps or intervals)
    datasets: [
      {
        label: "Real-Time Data",
        data: [], // Initial empty data array for Y-axis
        borderColor: "blue",
        fill: false,
        tension: 0.1, // For slight curve between points
      },
    ],
  },
  options: {
    scales: {
      x: {
        title: {
          display: true,
          text: "Time",
        },
      },
      y: {
        title: {
          display: true,
          text: "Value",
        },
        // min: 0,
        // max: 100,
      },
    },
    animation: false, // Disable animation for real-time updates
    responsive: true,
    maintainAspectRatio: false,
  },
});

// Function to update chart data
function updateChart(newDataPoint) {
  // Add a new label (e.g., time)
  chart.data.labels.push(`T${chart.data.labels.length + 1}`);

  // Add a new data point for Y-axis
  chart.data.datasets[0].data.push(newDataPoint);

  // // Keep the chart showing only the last 10 data points
  // if (chart.data.labels.length > 10) {
  //   chart.data.labels.shift();
  //   chart.data.datasets[0].data.shift();
  // }

  // Update the chart
  chart.update();
}

//
var last = 0;
setInterval(() => {
  last += (Math.random() - 0.5) * 100; // Random data between 0 and 100
  updateChart(last);
}, 100);
