'use client';

interface TableViewProps {
  data: any[];
  summary?: string;
}

export default function TableView({ data, summary }: TableViewProps) {
  if (!data || data.length === 0) {
    return (
      <div className="table-view-empty">
        <p>No data to display</p>
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="table-view">
      {summary && (
        <div className="table-view__header">
          <h3>{summary}</h3>
        </div>
      )}

      <div className="table-view__container">
        <table className="table-view__table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => {
                  const value = row[column];
                  const formatted = typeof value === 'number'
                    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : String(value);

                  return <td key={column}>{formatted}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .table-view {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #ffffff;
        }

        .table-view-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6b7280;
        }

        .table-view__header {
          padding: 2rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .table-view__header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
        }

        .table-view__container {
          flex: 1;
          overflow: auto;
          padding: 2rem;
        }

        .table-view__table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }

        .table-view__table thead {
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
        }

        .table-view__table th {
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.875rem;
          color: #374151;
          text-transform: capitalize;
        }

        .table-view__table td {
          padding: 1rem;
          border-top: 1px solid #e5e7eb;
          color: #1f2937;
        }

        .table-view__table tbody tr:hover {
          background: #f9fafb;
        }
      `}</style>
    </div>
  );
}
