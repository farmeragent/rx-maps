'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TypicalPasses from './_components/typical-passes';
import { THEME } from '../_lib/constants';

export default function FertilizerPhilosophyPage() {
  const router = useRouter();
  const [yieldGoal, setYieldGoal] = useState('');
  const [nutrientGoals, setNutrientGoals] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const yieldDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const nutrientDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadPhilosophy = async () => {
      try {
        setIsLoading(true);
        const [yieldResponse, nutrientResponse] = await Promise.all([
          fetch('/api/philosophy/yield-goal'),
          fetch('/api/philosophy/nutrient-goals')
        ]);

        if (yieldResponse.ok) {
          const data = await yieldResponse.json();
          setYieldGoal(data.value || '');
        }

        if (nutrientResponse.ok) {
          const data = await nutrientResponse.json();
          setNutrientGoals(data.value || '');
        }
      } catch (error) {
        console.error('Failed to load philosophy settings', error);
        setErrorMessage('Unable to load saved philosophy. Check your network connection.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPhilosophy();
  }, []);

  const saveYieldGoal = async (value: string) => {
    try {
      const response = await fetch('/api/philosophy/yield-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      if (!response.ok) {
        throw new Error('Failed to save yield goal');
      }
      setStatusMessage('Yield philosophy saved.');
    } catch (error) {
      console.error(error);
      setErrorMessage('Could not save yield goal.');
    }
  };

  const saveNutrientGoals = async (value: string) => {
    try {
      const response = await fetch('/api/philosophy/nutrient-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      if (!response.ok) {
        throw new Error('Failed to save nutrient goals');
      }
      setStatusMessage('Nutrient philosophy saved.');
    } catch (error) {
      console.error(error);
      setErrorMessage('Could not save nutrient goals.');
    }
  };

  const debouncedSaveYield = (value: string) => {
    if (yieldDebounceRef.current) {
      clearTimeout(yieldDebounceRef.current);
    }
    yieldDebounceRef.current = setTimeout(() => saveYieldGoal(value), 600);
  };

  const debouncedSaveNutrient = (value: string) => {
    if (nutrientDebounceRef.current) {
      clearTimeout(nutrientDebounceRef.current);
    }
    nutrientDebounceRef.current = setTimeout(() => saveNutrientGoals(value), 600);
  };

  const clearMessages = () => {
    setStatusMessage(null);
    setErrorMessage(null);
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
          padding: '24px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <button
          onClick={() => router.push('/')}
          onMouseEnter={(event) => {
            (event.currentTarget as HTMLButtonElement).style.background = THEME.BACKGROUND.BUTTON_PILL_HOVER;
          }}
          onMouseLeave={(event) => {
            (event.currentTarget as HTMLButtonElement).style.background = THEME.BACKGROUND.BUTTON_PILL;
          }}
          style={{
            background: THEME.BACKGROUND.BUTTON_PILL,
            border: THEME.BORDER.PILL,
            color: '#dcfce7',
            borderRadius: '9999px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: '16px' }}>←</span>
          Back to assistant
        </button>
        <div />
      </header>

      <main
        style={{
          flex: 1,
          maxWidth: '900px',
          width: '100%',
          margin: '0 auto',
          padding: '0 24px 80px'
        }}
      >
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '12px', color: '#f9fafb' }}>
            Define how you think about fertility.
          </h2>
          <p style={{ color: THEME.ACCENT.TEXT_MUTED, fontSize: '1.05rem', maxWidth: '640px' }}>
            Capture your high-level goals and guiding principles. These notes inform recommendations across your maps and reports.
          </p>
        </section>

        {isLoading && (
          <div style={{ marginBottom: '24px', color: THEME.ACCENT.TEXT_SUBTLE }}>
            Loading saved philosophy…
          </div>
        )}

        {statusMessage && (
          <div
            onClick={clearMessages}
            style={{
              marginBottom: '20px',
              padding: '14px 16px',
              background: THEME.BACKGROUND.STATUS_POSITIVE,
              border: THEME.BACKGROUND.STATUS_POSITIVE_BORDER,
              borderRadius: '12px',
              cursor: 'pointer',
              color: '#ddf6ea'
            }}
          >
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div
            onClick={clearMessages}
            style={{
              marginBottom: '20px',
              padding: '14px 16px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gap: '24px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
          }}
        >
          <div
            style={{
              background: THEME.BACKGROUND.PANEL,
              border: THEME.BORDER.MEDIUM,
              borderRadius: '18px',
              padding: '24px'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', color: THEME.ACCENT.TEXT_MUTED, marginBottom: '12px' }}>Yield philosophy</h3>
            <p style={{ color: THEME.ACCENT.TEXT_MUTED, marginBottom: '14px' }}>
              How do you set your target yields? Capture goals, constraints, and how you adjust them over time.
            </p>
            <textarea
              value={yieldGoal}
              onChange={(event) => {
                const value = event.target.value;
                setYieldGoal(value);
                clearMessages();
                debouncedSaveYield(value);
              }}
              placeholder="Example: Focus on 210 bu/ac on irrigated pivots with tissue tests every two weeks."
              rows={8}
              style={{
                width: '100%',
                // background: THEME.BACKGROUND.PANEL_DEEP,
                border: THEME.BORDER.INNER_CARD,
                borderRadius: '14px', 
                color: THEME.TEXT.DARK,
                padding: '14px',
                fontSize: '1rem',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>

          <div
            style={{
              background: THEME.BACKGROUND.PANEL,
              border: THEME.BORDER.MEDIUM,
              borderRadius: '18px',
              padding: '24px'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', color: THEME.ACCENT.TEXT_MUTED, marginBottom: '12px' }}>Nutrient philosophy</h3>
            <p style={{ color: THEME.ACCENT.TEXT_MUTED, marginBottom: '14px' }}>
              Describe how you approach nutrient applications, balancing agronomy, economics, and stewardship.
            </p>
            <textarea
              value={nutrientGoals}
              onChange={(event) => {
                const value = event.target.value;
                setNutrientGoals(value);
                clearMessages();
                debouncedSaveNutrient(value);
              }}
              placeholder="Example: Spoon-feed nitrogen pre-plant and split apply post-plant based on sensor data."
              rows={8}
              style={{
                width: '100%',
                // background: THEME.BACKGROUND.PANEL_DEEP,
                border: THEME.BORDER.INNER_CARD,
                borderRadius: '14px',
                color: THEME.TEXT.DARK,
                padding: '14px',
                fontSize: '1rem',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <TypicalPasses />
      </main>
    </div>
  );
}
