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

    new Chart(ctx, {
      type,
      data: {
        labels: data.labels,
        datasets: data.datasets
      },
      options: {
        ...options,
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          title: {
            display: true,
            text: data.title
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || ''
                const value = context.parsed.y
                return `${label}: ${value}${data.unit || '%'}`
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: data.yAxisLabel || 'Value'
            }
          },
          x: {
            title: {
              display: true,
              text: data.xAxisLabel || 'Time'
            }
          }
        }
      }
    })
  }, [data, type])

  return (
    <div className="relative">
      <canvas ref={chartRef} height={height} />
    </div>
  )
} 