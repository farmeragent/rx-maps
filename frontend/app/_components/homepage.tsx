"use client";
import { useState, FormEvent } from "react";

// This is the suggestions on the main page. Chat suggestions are different.
const SUGGESTIONS = [
  'Show me areas of low phosphorus in the north-of-road field',
  'What is the average yield target?',
  'Compare nutrient levels across fields',
];

interface HomepageProps {
  onSubmit: (question: string) => void;
}

export const Homepage = ({ onSubmit }: HomepageProps) => {
  const [question, setQuestion] = useState('');

  const handleSubmit = (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setQuestion('');
  };

  const handleSuggestion = (suggestion: string) => {
    onSubmit(suggestion);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      background: 'radial-gradient(circle at top, rgb(133, 202, 163) 0%, rgb(240, 253, 244) 100%)',
    }}>
      {/* Main header, leave out title for now */}
      {/* <h1 style={{
        fontSize: '3rem',
        fontWeight: 'bold',
        color: '#052e16',
        marginBottom: '0.5rem',
        textAlign: 'center',
      }}>
        Farm Pulse
      </h1> */}
      <p style={{
        fontSize: '1.2rem',
        color: 'rgba(5, 46, 22, 0.75)',
        marginBottom: '2rem',
        textAlign: 'center',
      }}>
        Ask questions about your agricultural data
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '600px', marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          backgroundColor: 'white',
          borderRadius: '50px',
          padding: '0.5rem',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your farm data..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              padding: '1rem 1.5rem',
              fontSize: '1rem',
              borderRadius: '50px',
            }}
          />
          <button
            type="submit"
            disabled={!question.trim()}
            style={{
              backgroundColor: question.trim() ? 'rgb(34, 197, 94)' : '#ccc',
              color: '#052e16',
              border: 'none',
              borderRadius: '50px',
              padding: '1rem 2rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: question.trim() ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s',
            }}
          >
            Ask
          </button>
        </div>
      </form>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        width: '100%',
        maxWidth: '800px',
      }}>
        {SUGGESTIONS.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleSuggestion(suggestion)}
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.18)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              color: '#052e16',
              fontSize: '0.9rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.28)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.18)';
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};
