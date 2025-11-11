'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { THEME } from '../constants';

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

  const accent = THEME.ACCENT;
  const background = THEME.BACKGROUND;
  const border = THEME.BORDER;
  const shadow = THEME.SHADOW;

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
        <div className={`chat-sidebar__messages-inner ${isFullWidth ? 'chat-sidebar__messages-inner--centered' : ''}`}>
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
              {Array.isArray(message.tableData) && message.tableData.length > 0 && (() => {
                const tableData = message.tableData;
                return (
                  <details className="chat-sidebar__table-details" open>
                    <summary className="chat-sidebar__table-summary">
                      <span className="chat-sidebar__table-arrow">▶</span>
                      Table Results ({tableData.length} rows)
                    </summary>
                    <div className="chat-sidebar__table-container">
                      <table className="chat-sidebar__table">
                        <thead>
                          <tr>
                            {Object.keys(tableData[0]).map((column) => {
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
                          {tableData.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {Object.keys(tableData[0]).map((column) => {
                                const value = row[column];
                                const formatted = typeof value === 'number'
                                  ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : String(value);

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
                );
              })()}
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
        <div className="chat-sidebar__composer-inner">
          <div className="chat-sidebar__input-wrapper">
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
          </div>
        </div>
      </form>

      <style jsx>{`
        .chat-sidebar {
          width: 400px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: ${background.SURFACE_PRIMARY};
          border-right: ${border.TABLE_ROW};
          transition: width 0.3s ease;
        }

        .chat-sidebar--full-width {
          width: 100%;
          border-right: none;
        }

        .chat-sidebar__header {
          padding: 20px;
          border-bottom: ${border.TABLE_ROW};
          background: ${background.SURFACE_ELEVATED};
          color: ${accent.TEXT_DARK};
          box-shadow: ${shadow.LIFT};
          position: sticky;
          top: 0;
          z-index: 2;
        }

        .chat-sidebar__actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .chat-sidebar__title {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 600;
          color: ${accent.TEXT_DARK};
        }

        .chat-sidebar__subtitle {
          margin: 0;
          font-size: 14px;
          color: ${accent.TEXT_MUTED};
        }

        .chat-sidebar__action-btn {
          padding: 6px 12px;
          background: ${background.BUTTON_PILL};
          color: ${accent.TEXT_DARK};
          border: ${border.PILL};
          border-radius: 999px;
          cursor: pointer;
          font-size: 12px;
          text-decoration: none;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
          box-shadow: ${shadow.LIFT};
        }

        .chat-sidebar__action-btn:hover {
          background: ${background.BUTTON_PILL_HOVER};
        }

        .chat-sidebar__action-btn--danger {
          background: rgba(248, 113, 113, 0.18);
          color: #7f1d1d;
          border-color: rgba(248, 113, 113, 0.35);
        }

        .chat-sidebar__action-btn--danger:hover {
          background: rgba(248, 113, 113, 0.28);
        }
        .chat-sidebar__messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: transparent;
        }

        .chat-sidebar--full-width .chat-sidebar__messages {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .chat-sidebar__messages-inner {
          width: 100%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          gap: inherit;
          margin: 0 auto;
        }

        .chat-sidebar__bubble {
          padding: 12px 16px;
          border-radius: 12px;
          max-width: 85%;
          border: ${border.TABLE_ROW};
          box-shadow: ${shadow.PANEL};
        }

        .chat-sidebar--full-width .chat-sidebar__bubble {
          max-width: 100%;
        }

        .chat-sidebar__bubble--user {
          background: ${accent.PRIMARY_GRADIENT};
          color: ${accent.TEXT_DARK};
          align-self: flex-end;
          border-color: transparent;
        }

        .chat-sidebar__bubble--assistant {
          background: ${background.SURFACE_ELEVATED};
          color: ${accent.TEXT_DARK};
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
          background: ${accent.TEXT_MUTED};
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
          color: ${accent.TEXT_SUBTLE};
          margin-top: 4px;
        }

        .chat-sidebar__sql-details {
          margin-top: 8px;
        }

        .chat-sidebar__sql-summary {
          cursor: pointer;
          padding: 6px 8px;
          background: rgba(15, 23, 42, 0.85);
          color: rgba(224, 242, 254, 0.92);
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
          background: rgba(30, 41, 59, 0.9);
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
          background: rgba(15, 23, 42, 0.95);
          color: rgba(56, 189, 248, 0.9);
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
          background: ${accent.PRIMARY_GRADIENT};
          color: ${accent.TEXT_DARK};
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
          background: rgba(241, 196, 15, 0.85);
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
          background: rgba(255, 255, 255, 0.94);
        }

        .chat-sidebar__table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .chat-sidebar__table thead {
          background: ${background.SURFACE_ELEVATED};
          position: sticky;
          top: 0;
        }

        .chat-sidebar__table th {
          padding: 6px 8px;
          text-align: left;
          font-weight: 600;
          color: ${accent.TEXT_DARK};
          border-bottom: ${border.TABLE_ROW};
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
          border-bottom: ${border.TABLE_ROW};
          color: ${accent.TEXT_DARK};
        }

        .chat-sidebar__table tbody tr:hover {
          background: ${background.CARD_TINT};
        }

        .chat-sidebar__table tbody tr:last-child td {
          border-bottom: none;
        }

        .chat-sidebar__field-link {
          background: none;
          border: none;
          color: rgba(${accent.RGB}, 0.85);
          text-decoration: underline;
          cursor: pointer;
          padding: 0;
          font: inherit;
          text-align: left;
        }

        .chat-sidebar__field-link:hover {
          color: rgba(${accent.RGB}, 1);
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
          background: ${accent.PRIMARY_GRADIENT};
          color: ${accent.TEXT_DARK};
        }

        .chat-sidebar__inline-action-btn--primary:hover {
          background: rgba(${accent.RGB}, 0.85);
        }

        .chat-sidebar__inline-action-btn--secondary {
          background: ${background.CARD_TINT};
          color: ${accent.TEXT_DARK};
          border-color: ${border.MEDIUM.split(' ')[2] ? border.MEDIUM.split(' ')[2] : 'transparent'};
        }

        .chat-sidebar__inline-action-btn--secondary:hover {
          background: ${background.CARD_TINT_HOVER};
        }

        .chat-sidebar__inline-action-btn--link {
          background: transparent;
          color: rgba(${accent.RGB}, 0.85);
          border-color: rgba(${accent.RGB}, 0.35);
        }

        .chat-sidebar__inline-action-btn--link:hover {
          background: rgba(${accent.RGB}, 0.1);
        }

        .chat-sidebar__composer {
          padding: 20px;
          border-top: ${border.TABLE_ROW};
          display: flex;
          justify-content: center;
          background: ${background.SURFACE_PRIMARY};
        }

        .chat-sidebar__composer-inner {
          width: 100%;
          max-width: 900px;
          display: flex;
        }

        .chat-sidebar__input-wrapper {
          flex: 1;
          display: flex;
          align-items: flex-end;
          gap: 12px;
          border-radius: 24px;
          border: ${border.MEDIUM};
          padding: 10px 12px 10px 16px;
          background: ${background.SURFACE_ELEVATED};
          box-shadow: ${shadow.PANEL};
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .chat-sidebar__input-wrapper:focus-within {
          border-color: rgba(${accent.RGB}, 0.6);
          box-shadow: ${shadow.PANEL}, 0 0 0 2px rgba(${accent.RGB}, 0.12);
        }

        .chat-sidebar__input {
          flex: 1;
          border: none;
          background: transparent;
          color: ${accent.TEXT_DARK};
          font-size: 15px;
          line-height: 1.6;
          resize: none;
          max-height: 120px;
          min-height: 36px;
          padding: 0;
          outline: none;
        }

        .chat-sidebar__send {
          padding: 10px 20px;
          background: ${accent.PRIMARY_GRADIENT};
          color: ${accent.TEXT_DARK};
          border: none;
          border-radius: 999px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: background 0.2s ease, transform 0.2s ease;
          box-shadow: ${shadow.PANEL};
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .chat-sidebar__send:hover:not(:disabled) {
          background: rgba(${accent.RGB}, 0.85);
          transform: translateY(-1px);
        }

        .chat-sidebar__send:disabled {
          background: rgba(${accent.RGB}, 0.25);
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}
