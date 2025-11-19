'use client';

import { ResponsiveScatterPlotCanvas } from '@nivo/scatterplot';

interface ScatterPlotData {
  data: Record<string, number[]>;
  x_column: string;
  y_column: string;
  title?: string;
  x_label?: string;
  y_label?: string;
}

interface ScatterPlotProps {
  plotData: ScatterPlotData;
}

export default function ScatterPlot({ plotData }: ScatterPlotProps) {
  const { data, x_column, y_column, title, x_label, y_label } = plotData;

  // Transform data from column format to Nivo format
  const nivoData = [
    {
      id: title || `${y_column} vs ${x_column}`,
      data: data[x_column].map((xValue, index) => ({
        x: xValue,
        y: data[y_column][index]
      }))
    }
  ];

  return (
    <div style={{ width: '100%', height: '100%', padding: '2rem', background: '#ffffff' }}>
      <div style={{
        marginBottom: '1.5rem',
        textAlign: 'center'
      }}>
        <h2 style={{
          margin: '0 0 0.5rem 0',
          fontSize: '1.75rem',
          fontWeight: 600,
          color: '#1f2937'
        }}>
          {title || `${y_column} vs ${x_column}`}
        </h2>
      </div>

      <div style={{ height: 'calc(100% - 5rem)' }}>
        <ResponsiveScatterPlotCanvas
          data={nivoData}
          margin={{ top: 60, right: 120, bottom: 70, left: 90 }}
          xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
          yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: x_label || x_column,
            legendPosition: 'middle',
            legendOffset: 46
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: y_label || y_column,
            legendPosition: 'middle',
            legendOffset: -60
          }}
          colors={{ scheme: 'pink_yellowGreen' }}
          nodeSize={8}
          useMesh={true}
          tooltip={({ node }) => (
            <div
              style={{
                background: 'white',
                padding: '9px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              <strong>{x_column}:</strong> {typeof node.data.x === 'number' ? node.data.x.toFixed(2) : node.data.x}
              <br />
              <strong>{y_column}:</strong> {typeof node.data.y === 'number' ? node.data.y.toFixed(2) : node.data.y}
            </div>
          )}
          theme={{
            axis: {
              domain: {
                line: {
                  stroke: '#777777',
                  strokeWidth: 1
                }
              },
              ticks: {
                line: {
                  stroke: '#777777',
                  strokeWidth: 1
                },
                text: {
                  fontSize: 11,
                  fill: '#333333'
                }
              },
              legend: {
                text: {
                  fontSize: 13,
                  fontWeight: 600,
                  fill: '#333333'
                }
              }
            },
            grid: {
              line: {
                stroke: '#e0e0e0',
                strokeWidth: 1,
                strokeDasharray: '4 4'
              }
            }
          }}
        />
      </div>
    </div>
  );
}
