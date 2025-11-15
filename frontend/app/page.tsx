'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { THEME } from './_lib/constants';

const SUGGESTIONS = [
  'Where should I apply lime in railroad pivot?',
  'What is the yield goal by field?',
  'Which acres were most off their yield goal?'
];

export default function LandingPage() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    router.push(`/hex-query?question=${encodeURIComponent(trimmed)}`);
  };

  const handleSuggestion = (suggestion: string) => {
    setQuestion(suggestion);
    setIsSubmitting(true);
    router.push(`/hex-query?question=${encodeURIComponent(suggestion)}`);
  };

  const goToSettings = () => {
    router.push('/fertilizer-philosophy');
  };

  const goToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: THEME.BACKGROUND.HERO,
        color: '#e5e7eb',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 40px'
        }}
      >
        <div
          onClick={goToDashboard}
          style={{
            fontSize: '18px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            color: '#f3f4f6'
          }}
        >
        </div>
        <button
          onClick={goToSettings}
          aria-label="Fertilizer philosophy settings"
          style={{
            background: THEME.BACKGROUND.BUTTON_PILL,
            border: THEME.BORDER.PILL,
            color: '#dcfce7',
            borderRadius: '9999px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'background 0.2s ease'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = THEME.BACKGROUND.BUTTON_PILL_HOVER;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = THEME.BACKGROUND.BUTTON_PILL;
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 11 4.1V4a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09A1.65 1.65 0 0 0 20 12a1.65 1.65 0 0 0-.6 1.3v.09Z" />
          </svg>
          Settings
        </button>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px 80px'
        }}
      >
        <div style={{ maxWidth: '720px', textAlign: 'center' }}>
          <p
            style={{
              fontSize: '1.05rem',
              color: 'rgba(209, 250, 229, 0.75)',
              marginBottom: '36px'
            }}
          >
            Explore yield trends, nutrient needs, and targeted recommendations—all with a single question.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: THEME.BACKGROUND.SURFACE_PRIMARY,
            border: THEME.BORDER.MEDIUM,
              borderRadius: '9999px',
              padding: '8px 12px',
              boxShadow: '0 12px 60px rgba(34, 197, 94, 0.25)',
              backdropFilter: 'blur(14px)'
            }}
          >
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about yield performance, nutrient plans, or field insights..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#000000',
                fontSize: '1.05rem',
                padding: '12px 4px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={isSubmitting || question.trim().length === 0}
              style={{
                background: THEME.ACCENT.PRIMARY_GRADIENT,
                border: 'none',
                color: THEME.ACCENT.TEXT_DARK,
                fontWeight: 600,
                borderRadius: '9999px',
                padding: '12px 24px',
                cursor: isSubmitting ? 'wait' : 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                boxShadow: THEME.SHADOW.LIFT,
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting ? 'Loading…' : 'Ask' }
            </button>
          </form>

          <div
            style={{
              marginTop: '48px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px'
            }}
          >
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestion(suggestion)}
                style={{
                  background: THEME.BACKGROUND.CARD_TINT,
                  border: THEME.BORDER.MEDIUM,
                  color: '#dcfce7',
                  textAlign: 'left',
                  padding: '16px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease, transform 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = THEME.BACKGROUND.CARD_TINT_HOVER;
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = THEME.BACKGROUND.CARD_TINT;
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </main>
      <footer
        style={{
          padding: '28px 40px',
          borderTop: THEME.BORDER.TABLE_ROW,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          color: 'rgba(209, 250, 229, 0.65)'
        }}
      >
        <div>Built for agronomists and farmers who want instant insight.</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span onClick={goToDashboard} style={{ cursor: 'pointer', color: '#4ade80' }}>Field Dashboard</span>
        </div>
      </footer>
    </div>
  );
}
