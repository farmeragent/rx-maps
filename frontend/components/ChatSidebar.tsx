'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import styles from './ChatSidebar.module.css';

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
    <div className={`${styles.chatSidebar} ${isFullWidth ? styles.chatSidebarFullWidth : ''}`}>
      <header className={styles.header}>
        <div>
          <p className={styles.title}>Query Assistant</p>
          <p className={styles.subtitle}>
            Ask about fields, nutrients, or yield trends.
          </p>
        </div>
        <div className={styles.actions}>
          <Link href="/" className={styles.actionBtn}>
            Dashboard
          </Link>
          {hasShownMap && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={onToggleWidth}
              title={isFullWidth ? "Show sidebar" : "Expand chat"}
            >
              {isFullWidth ? '⇲' : '⇱'}
            </button>
          )}
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={onClearHistory}
          >
            Clear history
          </button>
        </div>
      </header>

      <div className={styles.messages}>
        <div className={styles.messagesInner}>
        {messages.map((message, index) => {
          const roleClass =
            message.type === 'user'
              ? styles.bubbleUser
              : message.type === 'error'
              ? styles.bubbleError
              : styles.bubbleAssistant;

          return (
            <div key={index} className={`${styles.bubble} ${roleClass}`}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
              {message.metadata && (
                <div className={styles.meta}>{message.metadata}</div>
              )}
              {Array.isArray(message.tableData) && message.tableData.length > 0 && (() => {
                const tableData = message.tableData;
                return (
                  <details className={styles.tableDetails} open>
                    <summary className={styles.tableSummary}>
                      <span className={styles.tableArrow}>▶</span>
                      Table Results ({tableData.length} rows)
                    </summary>
                    <div className={styles.tableContainer}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            {Object.keys(tableData[0]).map((column) => {
                              const metadata = message.columnMetadata?.[column];
                              const displayName = metadata?.display_name || column.replace(/_/g, ' ');
                              const unit = metadata?.unit;
                              return (
                                <th key={column}>
                                  <div className={styles.tableHeader}>
                                    <div className={styles.tableHeaderName}>{displayName}</div>
                                    {unit && (
                                      <div className={styles.tableHeaderUnit}>[{unit}]</div>
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
                                        className={styles.fieldLink}
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
                <div className={styles.inlineActions}>
                  {message.actions.map((action) => {
                    const actionClass =
                      action.variant === 'primary'
                        ? `${styles.inlineActionBtn} ${styles.inlineActionBtnPrimary}`
                        : action.variant === 'secondary'
                        ? `${styles.inlineActionBtn} ${styles.inlineActionBtnSecondary}`
                        : `${styles.inlineActionBtn} ${styles.inlineActionBtnLink}`;

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
                <details className={styles.sqlDetails}>
                  <summary className={styles.sqlSummary}>
                    <span className={styles.sqlArrow}>▶</span>
                    View SQL Query
                  </summary>
                  <pre className={styles.sqlCode}>{message.sql}</pre>
                </details>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.bubbleThinking}`}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) {
            onSubmit();
          }
        }}
      >
        <div className={styles.composerInner}>
          <div className={styles.inputWrapper}>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your field data..."
              className={styles.input}
              rows={2}
            />
            <button type="submit" className={styles.send} disabled={!canSend}>
              Send
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
