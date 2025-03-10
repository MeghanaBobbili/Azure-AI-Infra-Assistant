import { useEffect, useRef } from 'react'

let Chart;
if (typeof window !== 'undefined') {
  import('chart.js/auto').then(module => {
    Chart = module.default;
  });
}

export default function MetricsChart({ data, type = 'line', height = 200, options = {} }) {
  const chartRef = useRef(null)

  useEffect(() => {
    if (!chartRef.current) return

    const ctx = chartRef.current.getContext('2d')
    const existingChart = Chart.getChart(ctx)
    if (existingChart) {
      existingChart.destroy()
    }

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)')  // Blue-500 with opacity
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)')  // Almost transparent

    new Chart(ctx, {
      type,
      data: {
        labels: data.labels,
        datasets: data.datasets.map(dataset => ({
          ...dataset,
          borderColor: 'rgb(59, 130, 246)',      // Blue-500
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,                          // Smooth curves
          borderWidth: 2,
          pointRadius: 3,                        // Smaller points
          pointHoverRadius: 6,                   // Larger on hover
          pointBackgroundColor: 'white',
          pointBorderColor: 'rgb(59, 130, 246)',
          pointHoverBackgroundColor: 'rgb(59, 130, 246)',
          pointHoverBorderColor: 'white'
        }))
      },
      options: {
        ...options,
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        plugins: {
          title: {
            display: true,
            text: data.title,
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: 20
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#1f2937',
            bodyColor: '#1f2937',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || ''
                const value = context.parsed.y
                return `${label}: ${value}${data.unit || '%'}`
              }
            }
          },
          legend: {
            display: true,
            position: 'top',
            align: 'center',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: data.yAxisLabel || 'Value',
              font: {
                size: 12,
                weight: 'bold'
              }
            },
            grid: {
              display: true,
              drawBorder: false,
              color: 'rgba(107, 114, 128, 0.1)'
            },
            ticks: {
              padding: 8,
              font: {
                size: 11
              }
            }
          },
          x: {
            title: {
              display: true,
              text: data.xAxisLabel || 'Time',
              font: {
                size: 12,
                weight: 'bold'
              }
            },
            grid: {
              display: false
            },
            ticks: {
              padding: 8,
              font: {
                size: 11
              },
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        animations: {
          tension: {
            duration: 1000,
            easing: 'linear'
          }
        }
      }
    })
  }, [data, type, height])

  return (
    <div className="relative bg-white p-4 rounded-lg shadow">
      <canvas ref={chartRef} height={height} />
    </div>
  )
} 