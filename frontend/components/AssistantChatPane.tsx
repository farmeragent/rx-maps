'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type MessageType = 'user' | 'bot' | 'error';

export interface AssistantHistoryMessage {
  type: MessageType;
  text: string;
  sql?: string;
  metadata?: string;
}

export interface AssistantChatResult {
  question: string;
  sql: string;
  results: any[];
  hex_ids: string[];
  count: number;
  summary: string;
}

interface ChatMessage extends AssistantHistoryMessage {
  id: string;
}

interface AssistantChatPaneProps {
  initialMessages?: AssistantHistoryMessage[];
  storageKey?: string;
  onResult?: (result: AssistantChatResult, question: string) => void;
}

const QUICK_PROMPTS = [
  'How do field costs compare this season?',
  'Which fields lack soil samples?',
  'Where should nitrogen applications be prioritized?',
  'Show yield progress for all fields.'
];

const DEFAULT_BOT_MESSAGE: AssistantHistoryMessage = {
  type: 'bot',
  text: "Hi! I'm ready to help you compare your fields. Ask about costs, nutrients, or yield insights anytime."
};

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeHistory(messages: AssistantHistoryMessage[] | undefined | null): ChatMessage[] {
  if (!messages || messages.length === 0) {
    return [{ ...DEFAULT_BOT_MESSAGE, id: createId() }];
  }

  return messages.map((message) => ({
    id: createId(),
    type: message.type,
    text: message.text,
    sql: message.sql,
    metadata: message.metadata
  }));
}

export default function AssistantChatPane({
  initialMessages,
  storageKey = 'assistantChatHistory',
  onResult
}: AssistantChatPaneProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(normalizeHistory(initialMessages));
  const [draft, setDraft] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialized) return;
    if (typeof window === 'undefined') return;

    let parsedHistory: AssistantHistoryMessage[] | null = null;

    try {
      const stored = storageKey ? sessionStorage.getItem(storageKey) : null;
      if (stored) {
        parsedHistory = JSON.parse(stored) as AssistantHistoryMessage[];
      }
    } catch (error) {
      console.error('Failed to load stored assistant history:', error);
    }

    const normalized = normalizeHistory(parsedHistory ?? initialMessages);
    setMessages(normalized);
    setInitialized(true);
  }, [initialMessages, storageKey, initialized]);

  useEffect(() => {
    if (!initialized) return;
    if (typeof window === 'undefined') return;
    if (!storageKey) return;

    try {
      const serializable = messages.map(({ id, ...rest }) => rest);
      sessionStorage.setItem(storageKey, JSON.stringify(serializable));
    } catch (error) {
      console.error('Failed to persist assistant chat history:', error);
    }
  }, [messages, storageKey, initialized]);

  useEffect(() => {
    const parent = scrollRef.current;
    if (!parent) return;
    parent.scrollTop = parent.scrollHeight;
  }, [messages, isThinking]);

  const canSend = draft.trim().length > 0 && !isThinking;

  const appendMessage = (message: AssistantHistoryMessage) => {
    setMessages((prev) => [...prev, { ...message, id: createId() }]);
  };

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => !prev);
  };

  const handlePrompt = (prompt: string) => {
    setDraft(prompt);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !canSend) return;

    appendMessage({ type: 'user', text: trimmed });
    setDraft('');
    setIsThinking(true);

    try {
      const response = await fetch('/api/hex-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || payload.detail || 'Assistant request failed');
      }

      const result = (await response.json()) as AssistantChatResult;
      const summaryText =
        result.summary ||
        "Here's what I discovered, but I may need more time to gather detailed insights.";
      const metadata =
        typeof result.count === 'number'
          ? `Found ${result.count.toLocaleString()} result(s).`
          : undefined;

      appendMessage({
        type: 'bot',
        text: summaryText,
        sql: result.sql,
        metadata
      });

      onResult?.(result, trimmed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      appendMessage({ type: 'error', text: message });
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <aside
      className={`assistant-pane${isCollapsed ? ' assistant-pane--collapsed' : ''}`}
      aria-label="Assistant conversation"
    >
      {isCollapsed ? (
        <button
          type="button"
          className="assistant-pane__toggle assistant-pane__toggle--floating"
          onClick={toggleCollapsed}
        >
          <span className="assistant-pane__toggle-icon">☰</span>
          <span>Assistant</span>
        </button>
      ) : (
        <div className="assistant-pane__surface">
          <header className="assistant-pane__header">
            <div>
              <p className="assistant-pane__title">Assistant</p>
              <p className="assistant-pane__subtitle">
                Continue where you left off or ask something new.
              </p>
            </div>
            <button
              type="button"
              className="assistant-pane__toggle"
              onClick={toggleCollapsed}
              aria-label="Collapse assistant chat"
            >
              →
            </button>
          </header>

          <div ref={scrollRef} className="assistant-pane__messages">
            {messages.map((message) => {
              const roleClass =
                message.type === 'user'
                  ? 'assistant-pane__bubble--user'
                  : message.type === 'error'
                    ? 'assistant-pane__bubble--error'
                    : 'assistant-pane__bubble--assistant';

              return (
                <div key={message.id} className={`assistant-pane__bubble ${roleClass}`}>
                  <div>{message.text}</div>
                  {message.metadata && <div className="assistant-pane__meta">{message.metadata}</div>}
                  {message.sql && (
                    <pre className="assistant-pane__sql" aria-label="Generated SQL">
                      {message.sql}
                    </pre>
                  )}
                </div>
              );
            })}
            {isThinking && (
              <div className="assistant-pane__bubble assistant-pane__bubble--assistant assistant-pane__bubble--thinking">
                <span className="assistant-pane__dot" />
                <span className="assistant-pane__dot" />
                <span className="assistant-pane__dot" />
              </div>
            )}
          </div>

          <div className="assistant-pane__quick">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="assistant-pane__quick-btn"
                onClick={() => handlePrompt(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <form className="assistant-pane__composer" onSubmit={handleSubmit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about your fields, nutrients, or yield plans..."
              className="assistant-pane__input"
              rows={2}
            />
            <button type="submit" className="assistant-pane__send" disabled={!canSend}>
              Send
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}

