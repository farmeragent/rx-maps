'use client';

import { useState, useEffect } from 'react';

type Phase = 'pre-plant' | 'plant' | 'post-plant';

interface PassTile {
  id: string;
  passNumber: string;
  machine: string;
  fertilizerType: string;
}

interface PhaseData {
  passes: PassTile[];
}

type TimelineData = Record<Phase, PhaseData>;

const PHASE_NAMES: Record<Phase, string> = {
  'pre-plant': 'Pre-plant',
  'plant': 'Plant',
  'post-plant': 'Post Plant'
};

const defaultTimelineData: TimelineData = {
  'pre-plant': { passes: [] },
  'plant': { passes: [] },
  'post-plant': { passes: [] }
};

async function fetchTimelineData(): Promise<TimelineData> {
  try {
    const response = await fetch('/api/passes');
    if (!response.ok) {
      throw new Error('Failed to fetch passes');
    }
    const data = await response.json();
    return data || defaultTimelineData;
  } catch (error) {
    console.error('Error fetching timeline data:', error);
    return defaultTimelineData;
  }
}

async function createPass(phase: Phase, pass: PassTile): Promise<TimelineData> {
  try {
    const response = await fetch('/api/passes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase, pass }),
    });
    if (!response.ok) {
      throw new Error('Failed to create pass');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating pass:', error);
    throw error;
  }
}

async function updatePass(phase: Phase, passId: string, updates: Partial<PassTile>): Promise<TimelineData> {
  try {
    const response = await fetch('/api/passes', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase, passId, updates }),
    });
    if (!response.ok) {
      throw new Error('Failed to update pass');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating pass:', error);
    throw error;
  }
}

async function deletePass(phase: Phase, passId: string): Promise<TimelineData> {
  try {
    const response = await fetch(`/api/passes?phase=${phase}&passId=${passId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete pass');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting pass:', error);
    throw error;
  }
}

export default function FertilityTimeline() {
  const [timelineData, setTimelineData] = useState<TimelineData>(defaultTimelineData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PassTile>>({});
  const [unsavedPassIds, setUnsavedPassIds] = useState<Set<string>>(new Set());

  // Load data from API on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchTimelineData();
        setTimelineData(data);
        setIsLoaded(true);
      } catch (err) {
        setError('Failed to load passes. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function addPass(phase: Phase) {
    const newPass: PassTile = {
      id: generateId(),
      passNumber: `Pass ${timelineData[phase].passes.length + 1}`,
      machine: '',
      fertilizerType: ''
    };
    
    // Add to UI (not saved to API yet)
    setTimelineData(prev => {
      const updated = {
        ...prev,
        [phase]: {
          passes: [...prev[phase].passes, newPass]
        }
      };
      return updated;
    });
    
    // Mark as unsaved
    setUnsavedPassIds(prev => new Set(prev).add(newPass.id));
    
    // Start editing the new pass immediately
    setEditingId(newPass.id);
    setEditForm(newPass);
  }

  function startEdit(pass: PassTile) {
    setEditingId(pass.id);
    setEditForm({ ...pass });
  }

  async function saveEdit(phase: Phase) {
    if (!editingId) return;
    
    const originalPass = timelineData[phase].passes.find(p => p.id === editingId);
    if (!originalPass) return;
    
    const isNewPass = unsavedPassIds.has(editingId);
    const updatedPass = { ...originalPass, ...editForm } as PassTile;
    
    // Optimistically update UI
    setTimelineData(prev => ({
      ...prev,
      [phase]: {
        passes: prev[phase].passes.map(pass =>
          pass.id === editingId ? updatedPass : pass
        )
      }
    }));
    
    setEditingId(null);
    setEditForm({});
    
    // Save to API
    try {
      let updatedData: TimelineData;
      if (isNewPass) {
        // Create new pass
        updatedData = await createPass(phase, updatedPass);
        // Remove from unsaved list
        setUnsavedPassIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(editingId);
          return newSet;
        });
      } else {
        // Update existing pass
        updatedData = await updatePass(phase, editingId, editForm);
      }
      setTimelineData(updatedData);
    } catch (err) {
      setError('Failed to save changes. Please try again.');
      // Revert optimistic update
      if (originalPass) {
        setTimelineData(prev => ({
          ...prev,
          [phase]: {
            passes: prev[phase].passes.map(pass =>
              pass.id === editingId ? originalPass : pass
            )
          }
        }));
      }
      // Reopen edit mode
      setEditingId(editingId);
      setEditForm({ ...originalPass, ...editForm });
    }
  }

  function cancelEdit() {
    const isNewPass = editingId && unsavedPassIds.has(editingId);
    
    if (isNewPass && editingId) {
      // Remove unsaved pass if canceling
      const phase = (['pre-plant', 'plant', 'post-plant'] as Phase[]).find(p =>
        timelineData[p].passes.some(pass => pass.id === editingId)
      );
      
      if (phase) {
        setTimelineData(prev => ({
          ...prev,
          [phase]: {
            passes: prev[phase].passes.filter(pass => pass.id !== editingId)
          }
        }));
        setUnsavedPassIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(editingId);
          return newSet;
        });
      }
    }
    
    setEditingId(null);
    setEditForm({});
  }

  async function handleDeletePass(phase: Phase, passId: string) {
    const passToDelete = timelineData[phase].passes.find(p => p.id === passId);
    const isNewPass = unsavedPassIds.has(passId);
    
    // Optimistically update UI
    setTimelineData(prev => ({
      ...prev,
      [phase]: {
        passes: prev[phase].passes.filter(pass => pass.id !== passId)
      }
    }));
    
    // Remove from unsaved list if it was unsaved
    if (isNewPass) {
      setUnsavedPassIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(passId);
        return newSet;
      });
    }
    
    if (editingId === passId) {
      cancelEdit();
    }
    
    // Only delete from API if it was already saved
    if (!isNewPass) {
      try {
        const updatedData = await deletePass(phase, passId);
        setTimelineData(updatedData);
      } catch (err) {
        setError('Failed to delete pass. Please try again.');
        // Revert optimistic update
        if (passToDelete) {
          setTimelineData(prev => ({
            ...prev,
            [phase]: {
              passes: [...prev[phase].passes, passToDelete]
            }
          }));
        }
      }
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Fertility Planning Timeline</h1>
        <p style={styles.subtitle}>Manage your fertilization passes across all phases</p>
        {error && (
          <div style={styles.errorMessage}>
            {error}
            <button
              onClick={() => setError(null)}
              style={styles.errorDismiss}
            >
              ×
            </button>
          </div>
        )}
        {isLoading && (
          <div style={styles.loadingMessage}>Loading passes...</div>
        )}
      </div>

      <div style={styles.timeline}>
        {(['pre-plant', 'plant', 'post-plant'] as Phase[]).map((phase, phaseIndex) => (
          <div key={phase} style={styles.phaseSection}>
            <div style={styles.phaseHeader}>
              <div style={styles.phaseIndicator}>
                <div style={styles.phaseNumber}>{phaseIndex + 1}</div>
                {phaseIndex < 2 && <div style={styles.phaseConnector} />}
              </div>
              <div style={styles.phaseTitleContainer}>
                <h2 style={styles.phaseTitle}>{PHASE_NAMES[phase]}</h2>
              </div>
            </div>
            <div style={styles.addButtonContainer}>
              <button
                style={styles.addButton}
                onClick={() => addPass(phase)}
                title="Add new pass"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                + Add Pass
              </button>
            </div>

            <div style={styles.passesContainer}>
              {timelineData[phase].passes.length === 0 ? (
                <div style={styles.emptyState}>
                  <p style={styles.emptyText}>No passes yet. Click "Add Pass" to get started.</p>
                </div>
              ) : (
                timelineData[phase].passes.map((pass) => (
                  <div key={pass.id} style={styles.passTile}>
                    {editingId === pass.id ? (
                      <div style={styles.editForm}>
                        <input
                          type="text"
                          placeholder="Pass Number"
                          value={editForm.passNumber || ''}
                          onChange={(e) => setEditForm({ ...editForm, passNumber: e.target.value })}
                          style={styles.input}
                        />
                        <input
                          type="text"
                          placeholder="Machine Used"
                          value={editForm.machine || ''}
                          onChange={(e) => setEditForm({ ...editForm, machine: e.target.value })}
                          style={styles.input}
                        />
                        <input
                          type="text"
                          placeholder="Fertilizer Type"
                          value={editForm.fertilizerType || ''}
                          onChange={(e) => setEditForm({ ...editForm, fertilizerType: e.target.value })}
                          style={styles.input}
                        />
                        <div style={styles.editActions}>
                          <button
                            style={styles.saveButton}
                            onClick={() => saveEdit(phase)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                            }}
                          >
                            Save
                          </button>
                          <button
                            style={styles.cancelButton}
                            onClick={cancelEdit}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#d0d0d0';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#e0e0e0';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={styles.tileHeader}>
                          <h3 style={styles.passNumber}>{pass.passNumber}</h3>
                          <div style={styles.tileActions}>
                            <button
                              style={styles.editIconButton}
                              onClick={() => startEdit(pass)}
                              title="Edit pass"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(45, 80, 22, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              style={styles.deleteIconButton}
                              onClick={() => handleDeletePass(phase, pass.id)}
                              title="Delete pass"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(220, 53, 69, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <div style={styles.tileContent}>
                          <div style={styles.infoRow}>
                            <span style={styles.label}>Machine:</span>
                            <span style={styles.value}>{pass.machine || 'Not specified'}</span>
                          </div>
                          <div style={styles.infoRow}>
                            <span style={styles.label}>Fertilizer:</span>
                            <span style={styles.value}>{pass.fertilizerType || 'Not specified'}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #2d5016, #4a7c59)',
    padding: '20px',
  },
  header: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: '30px 20px',
    margin: '0 auto 30px',
    maxWidth: 1400,
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 10px 0',
    color: '#2c3e50',
    fontSize: '32px',
    fontWeight: 600,
  },
  subtitle: {
    margin: 0,
    color: '#7f8c8d',
    fontSize: '16px',
  },
  timeline: {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-start',
    overflowX: 'auto',
    paddingBottom: '20px',
  },
  phaseSection: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: '30px',
    minWidth: '350px',
    flex: '1 1 0',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
  },
  phaseHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '15px',
  },
  phaseIndicator: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
  },
  phaseNumber: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2d5016, #4a7c59)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 600,
    boxShadow: '0 4px 15px rgba(45, 80, 22, 0.3)',
    flexShrink: 0,
  },
  phaseConnector: {
    width: '40px',
    height: '3px',
    background: 'linear-gradient(to right, #4a7c59, #2d5016)',
    marginLeft: '10px',
    marginRight: '10px',
  },
  phaseTitleContainer: {
    width: '100%',
    textAlign: 'center',
  },
  addButtonContainer: {
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'center',
  },
  phaseTitle: {
    margin: 0,
    color: '#2c3e50',
    fontSize: '24px',
    fontWeight: 600,
  },
  addButton: {
    background: 'linear-gradient(135deg, #2d5016, #4a7c59)',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  passesContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    flex: 1,
    overflowY: 'auto',
    maxHeight: '600px',
  },
  passTile: {
    background: '#f8f9fa',
    borderRadius: 12,
    padding: '20px',
    border: '2px solid #e0e0e0',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  tileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: '2px solid #e0e0e0',
  },
  passNumber: {
    margin: 0,
    color: '#2c3e50',
    fontSize: '18px',
    fontWeight: 600,
  },
  tileActions: {
    display: 'flex',
    gap: '8px',
  },
  editIconButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background 0.2s ease',
  },
  deleteIconButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background 0.2s ease',
  },
  tileContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#7f8c8d',
    fontSize: '14px',
    fontWeight: 500,
  },
  value: {
    color: '#2c3e50',
    fontSize: '14px',
    fontWeight: 400,
    textAlign: 'right',
    flex: 1,
    marginLeft: '10px',
  },
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    padding: '10px',
    border: '2px solid #e0e0e0',
    borderRadius: 8,
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s ease',
  },
  editActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '8px',
  },
  saveButton: {
    flex: 1,
    background: 'linear-gradient(135deg, #2d5016, #4a7c59)',
    color: 'white',
    border: 'none',
    padding: '10px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  cancelButton: {
    flex: 1,
    background: '#e0e0e0',
    color: '#2c3e50',
    border: 'none',
    padding: '10px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px',
    transition: 'background 0.2s ease, transform 0.2s ease',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#7f8c8d',
  },
  emptyText: {
    margin: 0,
    fontSize: '16px',
  },
  errorMessage: {
    background: '#fee',
    color: '#c33',
    padding: '10px 15px',
    borderRadius: '8px',
    marginTop: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
  },
  errorDismiss: {
    background: 'transparent',
    border: 'none',
    color: '#c33',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 5px',
    lineHeight: 1,
  },
  loadingMessage: {
    color: '#4a7c59',
    marginTop: '15px',
    fontSize: '14px',
  },
};

