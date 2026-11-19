/**
 * AETHER CAMPUS DIGITAL TWIN - CHARTS & VISUALIZATION ENGINE
 * Powered by Chart.js with custom dark glassmorphism palettes and glow styling.
 */

class CampusChartsEngine {
  constructor() {
    this.charts = {};
  }

  initForecastChart(canvasId, labels, data, upperBand, lowerBand, actuals = []) {
    const el = document.getElementById(canvasId);
    if (!el) return;

    if (this.charts.forecast) {
      this.charts.forecast.destroy();
      this.charts.forecast = null;
    }

    const ctx = el.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, 'rgba(0, 242, 254, 0.45)');
    grad.addColorStop(1, 'rgba(0, 242, 254, 0.02)');

    this.charts.forecast = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'ML Predicted Occupancy %',
            data: data,
            borderColor: '#00f2fe',
            backgroundColor: grad,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#00f2fe',
            pointRadius: 3,
            pointHoverRadius: 6
          },
          {
            label: 'Upper 90% Bound (+1.645×RMSE)',
            data: upperBand,
            borderColor: 'rgba(56, 189, 248, 0.3)',
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0.35
          },
          {
            label: 'Lower 90% Bound (-1.645×RMSE)',
            data: lowerBand,
            borderColor: 'rgba(56, 189, 248, 0.3)',
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0.35
          },
          {
            label: 'Test-Set Ground Truth (Actuals)',
            data: actuals,
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b',
            borderWidth: 0,
            showLine: false,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointStyle: 'circle'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
          },
          tooltip: {
            backgroundColor: 'rgba(13, 21, 39, 0.95)',
            titleColor: '#00f2fe',
            bodyColor: '#ffffff',
            borderColor: 'rgba(0, 242, 254, 0.3)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
          },
          y: {
            min: 0,
            max: 110,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: v => `${v}%`
            }
          }
        }
      }
    });
  }

  updateForecastData(labels, data, upperBand, lowerBand, actuals = null) {
    if (this.charts.forecast) {
      this.charts.forecast.data.labels = labels;
      this.charts.forecast.data.datasets[0].data = data;
      this.charts.forecast.data.datasets[1].data = upperBand;
      this.charts.forecast.data.datasets[2].data = lowerBand;
      if (actuals && this.charts.forecast.data.datasets[3]) {
        this.charts.forecast.data.datasets[3].data = actuals;
      }
      this.charts.forecast.update();
    }
  }

  setForecastActualsVisible(visible) {
    if (this.charts.forecast && this.charts.forecast.data.datasets[3]) {
      this.charts.forecast.data.datasets[3].hidden = !visible;
      this.charts.forecast.update();
    }
  }

  initCapacityChart(canvasId, labels, capacities, currentHeadcounts, simHeadcounts) {
    const el = document.getElementById(canvasId);
    if (!el) return;

    if (this.charts.capacity) {
      this.charts.capacity.destroy();
      this.charts.capacity = null;
    }

    const ctx = el.getContext('2d');

    this.charts.capacity = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Nominal Capacity',
            data: capacities,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Baseline Headcount',
            data: currentHeadcounts,
            backgroundColor: 'rgba(59, 130, 246, 0.65)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Simulated What-If',
            data: simHeadcounts,
            backgroundColor: 'rgba(244, 63, 94, 0.75)',
            borderColor: '#f43f5e',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
          }
        }
      }
    });
  }

  updateCapacityData(labels, capacities, currentHeadcounts, simHeadcounts) {
    if (this.charts.capacity) {
      this.charts.capacity.data.labels = labels;
      this.charts.capacity.data.datasets[0].data = capacities;
      this.charts.capacity.data.datasets[1].data = currentHeadcounts;
      this.charts.capacity.data.datasets[2].data = simHeadcounts;
      this.charts.capacity.update();
    }
  }

  initEnergyChart(canvasId, labels, energyData) {
    const el = document.getElementById(canvasId);
    if (!el) return;

    if (this.charts.energy) {
      this.charts.energy.destroy();
      this.charts.energy = null;
    }

    const ctx = el.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

    this.charts.energy = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Campus Power Draw (kWh)',
          data: energyData,
          borderColor: '#10b981',
          backgroundColor: grad,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: v => `${v} kWh`
            }
          }
        }
      }
    });
  }

  updateEnergyData(labels, energyData) {
    if (this.charts.energy) {
      this.charts.energy.data.labels = labels;
      this.charts.energy.data.datasets[0].data = energyData;
      this.charts.energy.update();
    }
  }

  initFeatureImportanceChart(canvasId, featuresList) {
    const el = document.getElementById(canvasId);
    if (!el) return;

    if (this.charts.importance) {
      this.charts.importance.destroy();
      this.charts.importance = null;
    }

    const ctx = el.getContext('2d');
    const labels = featuresList.map(f => f.feature);
    const data = featuresList.map(f => f.importance);

    this.charts.importance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Predictive Feature Importance (%)',
          data: data,
          backgroundColor: 'rgba(56, 189, 248, 0.65)',
          borderColor: '#38bdf8',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: v => `${v}%`
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  }

  initValidationChart(canvasId, actual, predicted) {
    const el = document.getElementById(canvasId);
    if (!el) return;

    if (this.charts.validation) {
      this.charts.validation.destroy();
      this.charts.validation = null;
    }

    const ctx = el.getContext('2d');
    const labels = actual.map((_, i) => `Test #${i+1}`);

    this.charts.validation = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Actual Telemetry Occupancy %',
            data: actual,
            borderColor: '#94a3b8',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#94a3b8',
            tension: 0.2
          },
          {
            label: 'Random Forest Predicted %',
            data: predicted,
            borderColor: '#10b981',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#10b981',
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 9 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: v => `${v}%`
            }
          }
        }
      }
    });
  }

  destroyAll() {
    Object.keys(this.charts).forEach(key => {
      if (this.charts[key]) {
        this.charts[key].destroy();
        this.charts[key] = null;
      }
    });
  }
}
