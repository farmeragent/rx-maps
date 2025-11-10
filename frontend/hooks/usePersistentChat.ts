import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, ChatMessageAction } from '../components/ChatSidebar';

interface UsePersistentChatOptions {
  storageKey?: string;
  initialMessages: ChatMessage[];
}

const DEFAULT_STORAGE_KEY = 'chatSidebarMessages';

const cloneActions = (actions?: ChatMessageAction[]) =>
  actions ? actions.map((action) => ({ ...action })) : undefined;

const cloneMessages = (messages: ChatMessage[]) =>
  messages.map((message) => ({
    ...message,
    tableData: message.tableData ? [...message.tableData] : undefined,
    columnMetadata: message.columnMetadata ? { ...message.columnMetadata } : undefined,
    actions: cloneActions(message.actions)
  }));

export function usePersistentChat(options: UsePersistentChatOptions) {
  const { storageKey = DEFAULT_STORAGE_KEY, initialMessages } = options;
  const initialMessagesRef = useRef<ChatMessage[]>(cloneMessages(initialMessages));
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessagesRef.current);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    initialMessagesRef.current = cloneMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsHydrated(true);
      return;
    }

    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMessages(parsed as ChatMessage[]);
        }
      }
    } catch (error) {
      console.error('Failed to restore chat history:', error);
      window.sessionStorage.removeItem(storageKey);
    } finally {
      setIsHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') {
      return;
    }

    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to persist chat history:', error);
    }
  }, [messages, storageKey, isHydrated]);

  const resetMessages = () => {
    const defaults = cloneMessages(initialMessagesRef.current);
    setMessages(defaults);

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(defaults));
      } catch (error) {
        console.error('Failed to reset chat history:', error);
      }
    }
  };

  const clearPersistedMessages = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(storageKey);
    }
  };

  return useMemo(
    () => ({
      messages,
      setMessages,
      resetMessages,
      isHydrated,
      clearPersistedMessages
    }),
    [messages, isHydrated]
  );
}

