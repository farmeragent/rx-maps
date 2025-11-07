'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TypicalPasses from '../../components/TypicalPasses';

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
        background: 'linear-gradient(180deg, #102417 0%, #0b1a12 40%, #061009 100%)',
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
          style={{
            background: 'rgba(34,197,94,0.18)',
            border: '1px solid rgba(34,197,94,0.35)',
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
        <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Fertilizer Philosophy
        </h1>
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
          <p style={{ color: 'rgba(209, 250, 229, 0.78)', fontSize: '1.05rem', maxWidth: '640px' }}>
            Capture your high-level goals and guiding principles. These notes inform recommendations across your maps and reports.
          </p>
        </section>

        {isLoading && (
          <div style={{ marginBottom: '24px', color: 'rgba(209, 213, 219, 0.65)' }}>
            Loading saved philosophy…
          </div>
        )}

        {statusMessage && (
          <div
            onClick={clearMessages}
            style={{
              marginBottom: '20px',
              padding: '14px 16px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '12px',
              cursor: 'pointer'
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
              background: 'rgba(22, 101, 52, 0.18)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              borderRadius: '18px',
              padding: '24px'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', color: '#d1fae5', marginBottom: '12px' }}>Yield philosophy</h3>
            <p style={{ color: 'rgba(209, 250, 229, 0.78)', marginBottom: '14px' }}>
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
                background: 'rgba(6, 24, 13, 0.78)',
                border: '1px solid rgba(74, 222, 128, 0.28)',
                borderRadius: '14px',
                color: '#f9fafb',
                padding: '14px',
                fontSize: '1rem',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>

          <div
            style={{
              background: 'rgba(21, 128, 61, 0.16)',
              border: '1px solid rgba(74, 222, 128, 0.32)',
              borderRadius: '18px',
              padding: '24px'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', color: '#dbeafe', marginBottom: '12px' }}>Nutrient philosophy</h3>
            <p style={{ color: 'rgba(209, 250, 229, 0.78)', marginBottom: '14px' }}>
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
                background: 'rgba(6, 24, 13, 0.78)',
                border: '1px solid rgba(74, 222, 128, 0.28)',
                borderRadius: '14px',
                color: '#f9fafb',
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
