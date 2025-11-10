'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';

export type ChatActionVariant = 'primary' | 'secondary' | 'link';

export interface ChatMessageAction {
  label: string;
  value: string;
  variant?: ChatActionVariant;
}

export interface ChatMessage {
  type: 'user' | 'bot' | 'error';
  text: string;
  sql?: string;
  metadata?: string;
  tableData?: any[];
  columnMetadata?: Record<string, { display_name: string; unit?: string }>;
  actions?: ChatMessageAction[];
  actionId?: string;
}

interface ChatSidebarProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onClearHistory: () => void;
  onToggleWidth: () => void;
  isLoading: boolean;
  isFullWidth: boolean;
  hasShownMap: boolean;
  onAction: (value: string, actionId?: string) => void;
}

export default function ChatSidebar({
  messages,
  inputValue,
  onInputChange,
  onSubmit,
  onClearHistory,
  onToggleWidth,
  isLoading,
  isFullWidth,
  hasShownMap,
  onAction
}: ChatSidebarProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canSend = inputValue.trim().length > 0 && !isLoading;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        onSubmit();
      }
    }
  };

  return (
    <div className={`chat-sidebar ${isFullWidth ? 'chat-sidebar--full-width' : ''}`}>
      <header className="chat-sidebar__header">
        <div>
          <p className="chat-sidebar__title">Query Assistant</p>
          <p className="chat-sidebar__subtitle">
            Ask about fields, nutrients, or yield trends.
          </p>
        </div>
        <div className="chat-sidebar__actions">
          <Link href="/" className="chat-sidebar__action-btn">
            Dashboard
          </Link>
          {hasShownMap && (
            <button
              type="button"
              className="chat-sidebar__action-btn"
              onClick={onToggleWidth}
              title={isFullWidth ? "Show sidebar" : "Expand chat"}
            >
              {isFullWidth ? '⇲' : '⇱'}
            </button>
          )}
          <button
            type="button"
            className="chat-sidebar__action-btn chat-sidebar__action-btn--danger"
            onClick={onClearHistory}
          >
            Clear history
          </button>
        </div>
      </header>

      <div className="chat-sidebar__messages">
        {messages.map((message, index) => {
          const roleClass =
            message.type === 'user'
              ? 'chat-sidebar__bubble--user'
              : message.type === 'error'
              ? 'chat-sidebar__bubble--error'
              : 'chat-sidebar__bubble--assistant';

          return (
            <div key={index} className={`chat-sidebar__bubble ${roleClass}`}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
              {message.metadata && (
                <div className="chat-sidebar__meta">{message.metadata}</div>
              )}
              {message.tableData && message.tableData.length > 0 && (
                <details className="chat-sidebar__table-details" open>
                  <summary className="chat-sidebar__table-summary">
                    <span className="chat-sidebar__table-arrow">▶</span>
                    Table Results ({message.tableData.length} rows)
                  </summary>
                  <div className="chat-sidebar__table-container">
                    <table className="chat-sidebar__table">
                      <thead>
                        <tr>
                          {Object.keys(message.tableData[0]).map((column) => {
                            const metadata = message.columnMetadata?.[column];
                            const displayName = metadata?.display_name || column.replace(/_/g, ' ');
                            const unit = metadata?.unit;
                            return (
                              <th key={column}>
                                <div className="chat-sidebar__table-header">
                                  <div className="chat-sidebar__table-header-name">{displayName}</div>
                                  {unit && (
                                    <div className="chat-sidebar__table-header-unit">[{unit}]</div>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {message.tableData.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {Object.keys(message.tableData[0]).map((column) => {
                              const value = row[column];
                              const formatted = typeof value === 'number'
                                ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                : String(value);

                              // Make field_name column clickable
                              if (column === 'field_name') {
                                return (
                                  <td key={column}>
                                    <button
                                      onClick={() => onAction(`view_field:${value}`, undefined)}
                                      className="chat-sidebar__field-link"
                                    >
                                      {formatted}
                                    </button>
                                  </td>
                                );
                              }

                              return <td key={column}>{formatted}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              {message.actions && message.actions.length > 0 && (
                <div className="chat-sidebar__inline-actions">
                  {message.actions.map((action) => {
                    const actionClass =
                      action.variant === 'primary'
                        ? 'chat-sidebar__inline-action-btn chat-sidebar__inline-action-btn--primary'
                        : action.variant === 'secondary'
                        ? 'chat-sidebar__inline-action-btn chat-sidebar__inline-action-btn--secondary'
                        : 'chat-sidebar__inline-action-btn chat-sidebar__inline-action-btn--link';

                    return (
                      <button
                        key={action.value}
                        type="button"
                        className={actionClass}
                        onClick={() => onAction(action.value, message.actionId)}
                      >
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {message.sql && (
                <details className="chat-sidebar__sql-details">
                  <summary className="chat-sidebar__sql-summary">
                    <span className="chat-sidebar__sql-arrow">▶</span>
                    View SQL Query
                  </summary>
                  <pre className="chat-sidebar__sql-code">{message.sql}</pre>
                </details>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="chat-sidebar__bubble chat-sidebar__bubble--assistant chat-sidebar__bubble--thinking">
            <span className="chat-sidebar__dot" />
            <span className="chat-sidebar__dot" />
            <span className="chat-sidebar__dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        className="chat-sidebar__composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) {
            onSubmit();
          }
        }}
      >
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your field data..."
          className="chat-sidebar__input"
          rows={2}
        />
        <button type="submit" className="chat-sidebar__send" disabled={!canSend}>
          Send
        </button>
      </form>

      <style jsx>{`
        .chat-sidebar {
          width: 400px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: white;
          border-right: 1px solid #e5e7eb;
          transition: width 0.3s ease;
        }

        .chat-sidebar--full-width {
          width: 100%;
          border-right: none;
        }

        .chat-sidebar__header {
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .chat-sidebar--full-width .chat-sidebar__header {
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .chat-sidebar__title {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
        }

        .chat-sidebar__subtitle {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .chat-sidebar__actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .chat-sidebar__action-btn {
          padding: 6px 12px;
          background: #f3f4f6;
          color: #374151;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          text-decoration: none;
          transition: background 0.2s;
        }

        .chat-sidebar__action-btn:hover {
          background: #e5e7eb;
        }

        .chat-sidebar__action-btn--danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .chat-sidebar__action-btn--danger:hover {
          background: #fecaca;
        }

        .chat-sidebar__messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .chat-sidebar--full-width .chat-sidebar__messages {
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .chat-sidebar__bubble {
          padding: 12px 16px;
          border-radius: 12px;
          max-width: 85%;
        }

        .chat-sidebar--full-width .chat-sidebar__bubble {
          max-width: 800px;
        }

        .chat-sidebar__bubble--user {
          background: #3b82f6;
          color: white;
          align-self: flex-end;
        }

        .chat-sidebar__bubble--assistant {
          background: #f3f4f6;
          color: #1f2937;
          align-self: flex-start;
        }

        .chat-sidebar__bubble--error {
          background: #fee2e2;
          color: #991b1b;
          align-self: flex-start;
        }

        .chat-sidebar__bubble--thinking {
          display: flex;
          gap: 4px;
          padding: 12px 20px;
        }

        .chat-sidebar__dot {
          width: 8px;
          height: 8px;
          background: #9ca3af;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .chat-sidebar__dot:nth-child(1) {
          animation-delay: -0.32s;
        }

        .chat-sidebar__dot:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        .chat-sidebar__meta {
          font-size: 11px;
          color: #6b7280;
          margin-top: 4px;
        }

        .chat-sidebar__sql-details {
          margin-top: 8px;
        }

        .chat-sidebar__sql-summary {
          cursor: pointer;
          padding: 6px 8px;
          background: #374151;
          color: #9ca3af;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          user-select: none;
          list-style: none;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .chat-sidebar__sql-summary:hover {
          background: #4b5563;
        }

        .chat-sidebar__sql-arrow {
          font-size: 9px;
          display: inline-block;
          transition: transform 0.2s ease;
        }

        .chat-sidebar__sql-details[open] .chat-sidebar__sql-arrow {
          transform: rotate(90deg);
        }

        .chat-sidebar__sql-code {
          margin-top: 6px;
          padding: 8px;
          background: #1f2937;
          color: #10b981;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .chat-sidebar__table-details {
          margin-top: 8px;
        }

        .chat-sidebar__table-summary {
          cursor: pointer;
          padding: 6px 8px;
          background: #3b82f6;
          color: white;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          user-select: none;
          list-style: none;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .chat-sidebar__table-summary:hover {
          background: #2563eb;
        }

        .chat-sidebar__table-arrow {
          font-size: 9px;
          display: inline-block;
          transition: transform 0.2s ease;
        }

        .chat-sidebar__table-details[open] .chat-sidebar__table-arrow {
          transform: rotate(90deg);
        }

        .chat-sidebar__table-container {
          margin-top: 6px;
          overflow-x: auto;
          max-height: 300px;
          overflow-y: auto;
          border-radius: 4px;
          background: white;
        }

        .chat-sidebar__table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .chat-sidebar__table thead {
          background: #f3f4f6;
          position: sticky;
          top: 0;
        }

        .chat-sidebar__table th {
          padding: 6px 8px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
        }

        .chat-sidebar__table-header {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .chat-sidebar__table-header-name {
          font-weight: 600;
          color: #374151;
          white-space: nowrap;
        }

        .chat-sidebar__table-header-unit {
          font-size: 10px;
          font-weight: 400;
          color: #6b7280;
          white-space: nowrap;
        }

        .chat-sidebar__table td {
          padding: 6px 8px;
          border-bottom: 1px solid #e5e7eb;
          color: #1f2937;
        }

        .chat-sidebar__table tbody tr:hover {
          background: #f9fafb;
        }

        .chat-sidebar__table tbody tr:last-child td {
          border-bottom: none;
        }

        .chat-sidebar__field-link {
          background: none;
          border: none;
          color: #2563eb;
          text-decoration: underline;
          cursor: pointer;
          padding: 0;
          font: inherit;
          text-align: left;
        }

        .chat-sidebar__field-link:hover {
          color: #1d4ed8;
        }

        .chat-sidebar__inline-actions {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chat-sidebar__inline-action-btn {
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }

        .chat-sidebar__inline-action-btn--primary {
          background: #2563eb;
          color: white;
        }

        .chat-sidebar__inline-action-btn--primary:hover {
          background: #1d4ed8;
        }

        .chat-sidebar__inline-action-btn--secondary {
          background: #f3f4f6;
          color: #1f2937;
        }

        .chat-sidebar__inline-action-btn--secondary:hover {
          background: #e5e7eb;
        }

        .chat-sidebar__inline-action-btn--link {
          background: transparent;
          color: #2563eb;
          border-color: #2563eb;
        }

        .chat-sidebar__inline-action-btn--link:hover {
          background: rgba(37, 99, 235, 0.1);
        }

        .chat-sidebar__composer {
          padding: 20px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 8px;
          background: white;
        }

        .chat-sidebar--full-width .chat-sidebar__composer {
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .chat-sidebar__input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          font-family: inherit;
          resize: none;
        }

        .chat-sidebar__input:focus {
          border-color: #3b82f6;
        }

        .chat-sidebar__send {
          padding: 12px 24px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: background 0.2s;
        }

        .chat-sidebar__send:hover:not(:disabled) {
          background: #2563eb;
        }

        .chat-sidebar__send:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
