'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface StoredMultiFieldPayload {
  question: string;
  results: any[];
  summary?: string;
  sql?: string;
  count?: number;
  timestamp?: number;
}

const MULTI_FIELD_STORAGE_KEY = 'assistantMultiField';
function formatHeading(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderCell(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default function MultiFieldResultsPage() {
  const [payload, setPayload] = useState<StoredMultiFieldPayload | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let storedPayload: StoredMultiFieldPayload | null = null;

    try {
      const rawPayload = sessionStorage.getItem(MULTI_FIELD_STORAGE_KEY);
      if (rawPayload) {
        storedPayload = JSON.parse(rawPayload) as StoredMultiFieldPayload;
      }
    } catch (error) {
      console.error('Failed to parse multi-field payload:', error);
    }

    if (storedPayload) {
      setPayload(storedPayload);
    }
  }, []);

  const columns = useMemo(() => {
    if (!payload?.results || payload.results.length === 0) {
      return [];
    }

    const headerSet = new Set<string>();
    payload.results.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      Object.keys(row).forEach((key) => headerSet.add(key));
    });
    return Array.from(headerSet);
  }, [payload]);

  const rowCount = payload?.results?.length ?? 0;

  return (
    <div className="multi-field-page">
      <div className="multi-field-page__content">
        <header className="multi-field-page__header">
          <div>
            <p className="multi-field-page__eyebrow">Assistant Results</p>
            <h1 className="multi-field-page__title">
              {payload?.question || 'Compare multiple fields'}
            </h1>
            {payload?.summary && (
              <p className="multi-field-page__summary">{payload.summary}</p>
            )}
            <div className="multi-field-page__meta">
              <span className="multi-field-page__meta-item">
                {rowCount.toLocaleString()} row{rowCount === 1 ? '' : 's'}
              </span>
              {payload?.timestamp && (
                <span className="multi-field-page__meta-item">
                  Updated {new Date(payload.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className="multi-field-page__actions">
            <Link href="/hex-query" className="multi-field-page__link">
              Back to Assistant
            </Link>
          </div>
        </header>

        <section className="multi-field-card">
          <h2 className="multi-field-card__title">Dynamic field comparison</h2>
          {payload?.sql && (
            <details className="multi-field-card__details">
              <summary>View generated SQL</summary>
              <pre className="multi-field-card__sql">{payload.sql}</pre>
            </details>
          )}
          {columns.length === 0 || rowCount === 0 ? (
            <div className="multi-field-card__empty">
              <p>No multi-field data is available yet.</p>
              <p>Ask the assistant for a comparison across multiple fields to populate this table.</p>
            </div>
          ) : (
            <div className="multi-field-table" role="region" aria-live="polite">
              <table>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column}>{formatHeading(column)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload?.results?.map((row, index) => (
                    <tr key={index}>
                      {columns.map((column) => (
                        <td key={column}>{renderCell(row?.[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

    </div>
  );
}

