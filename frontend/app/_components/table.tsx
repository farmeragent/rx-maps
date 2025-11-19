'use client';

interface TableProps {
  data: Record<string, any>[];
  emptyMessage?: string;
}

export default function Table({ data, emptyMessage = 'No table data available. Please execute a query that returns table data.' }: TableProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '2rem',
        textAlign: 'center',
        color: '#666'
      }}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Get all unique keys from all rows to handle cases where rows might have different keys
  const allKeys = Array.from(
    new Set(
      data.flatMap(row => Object.keys(row))
    )
  );

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            {allKeys.map((key) => (
              <th key={key} style={{
                padding: '12px',
                textAlign: 'left',
                borderBottom: '2px solid #ddd',
                fontWeight: '600'
              }}>
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index} style={{
              borderBottom: '1px solid #eee'
            }}>
              {allKeys.map((key, cellIndex) => (
                <td key={cellIndex} style={{
                  padding: '12px',
                  borderRight: '1px solid #eee'
                }}>
                  {row[key] !== null && row[key] !== undefined ? String(row[key]) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

