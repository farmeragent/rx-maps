import type { ChatMessage } from '../components/ChatSidebar';

export const DEFAULT_CHAT_MESSAGES: ChatMessage[] = [
  {
    type: 'bot',
    text:
      '👋 Hi! I can help you query your agricultural hex data. Try asking:\n' +
      '• "Show me hexes with low phosphorus"\n' +
      '• "What\'s the average yield target?"\n' +
      '• "Find hexes that need more than 100 units of nitrogen"\n' +
      '• "Show hexes with high yield and low potassium"'
  }
];

