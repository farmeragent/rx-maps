'use client';

import { useState, useEffect, useRef } from 'react';

type Phase = 'pre-plant' | 'post-plant';

interface PassTile {
  id: string;
  passNumber: string;
  machine: string;
  nutrientTypes: string;
  vrRx: boolean;
}

interface PhaseData {
  passes: PassTile[];
}

type TimelineData = Record<Phase, PhaseData>;

const PHASE_NAMES: Record<Phase, string> = {
  'pre-plant': 'Pre-plant',
  'post-plant': 'Post-plant'
};

const defaultTimelineData: TimelineData = {
  'pre-plant': { passes: [] },
  'post-plant': { passes: [] }
};

// Helper function to get machine icon type
function getMachineIcon(machine: string): string {
  const lowerMachine = machine.toLowerCase();
  if (lowerMachine.includes('spreader')) return 'spreader';
  if (lowerMachine.includes('planter')) return 'planter';
  if (lowerMachine.includes('colter')) return 'colter';
  return 'spreader'; // default
}

const MACHINE_OPTIONS = [
  '600R Spreader',
  '1775NT planter',
  '2510L colter rig'
];

const NUTRIENT_TYPE_OPTIONS = [
  'DAP',
  'KNO3',
  'Ammonium Nitrate',
  'Ammonium Nitrate, Ammonium Sulfate'
];

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
  
  const [yieldGoal, setYieldGoal] = useState<string>('');
  const [nutrientGoals, setNutrientGoals] = useState<string>('');
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const yieldGoalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nutrientGoalsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [draggedPassId, setDraggedPassId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load data from API on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchTimelineData();
        // Renumber passes based on their order
        const renumberedData: TimelineData = {
          'pre-plant': {
            passes: data['pre-plant'].passes.map((pass, index) => ({
              ...pass,
              passNumber: `${index + 1}`
            }))
          },
          'post-plant': {
            passes: data['post-plant'].passes.map((pass, index) => ({
              ...pass,
              passNumber: `${index + 1}`
            }))
          }
        };
        setTimelineData(renumberedData);
        setIsLoaded(true);
      } catch (err) {
        setError('Failed to load passes. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    
    async function loadGoals() {
      try {
        const [yieldResponse, nutrientResponse] = await Promise.all([
          fetch('/api/philosophy/yield-goal'),
          fetch('/api/philosophy/nutrient-goals')
        ]);
        
        if (yieldResponse.ok) {
          const yieldData = await yieldResponse.json();
          setYieldGoal(yieldData.value || '');
        }
        
        if (nutrientResponse.ok) {
          const nutrientData = await nutrientResponse.json();
          setNutrientGoals(nutrientData.value || '');
        }
      } catch (err) {
        console.error('Error loading goals:', err);
      }
    }
    
    loadData();
    loadGoals();
    
    // Cleanup timeouts on unmount
    return () => {
      if (yieldGoalTimeoutRef.current) {
        clearTimeout(yieldGoalTimeoutRef.current);
      }
      if (nutrientGoalsTimeoutRef.current) {
        clearTimeout(nutrientGoalsTimeoutRef.current);
      }
    };
  }, []);
  
  async function saveYieldGoal(value: string) {
    setIsSavingGoals(true);
    try {
      const response = await fetch('/api/philosophy/yield-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!response.ok) throw new Error('Failed to save yield goal');
    } catch (err) {
      console.error('Error saving yield goal:', err);
      setError('Failed to save yield goal. Please try again.');
    } finally {
      setIsSavingGoals(false);
    }
  }
  
  async function saveNutrientGoals(value: string) {
    setIsSavingGoals(true);
    try {
      const response = await fetch('/api/philosophy/nutrient-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!response.ok) throw new Error('Failed to save nutrient goals');
    } catch (err) {
      console.error('Error saving nutrient goals:', err);
      setError('Failed to save nutrient goals. Please try again.');
    } finally {
      setIsSavingGoals(false);
    }
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function addPass(phase: Phase) {
    const newPass: PassTile = {
      id: generateId(),
      passNumber: `${timelineData[phase].passes.length + 1}`,
      machine: '',
      nutrientTypes: '',
      vrRx: false
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
      const phase = (['pre-plant', 'post-plant'] as Phase[]).find(p =>
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

  async function handleDragStart(phase: Phase, passId: string) {
    setDraggedPassId(passId);
  }

  async function handleDragOver(phase: Phase, index: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  async function handleDragLeave() {
    setDragOverIndex(null);
  }

  async function handleDrop(phase: Phase, dropIndex: number) {
    if (!draggedPassId) return;
    
    const currentPasses = [...timelineData[phase].passes];
    const draggedIndex = currentPasses.findIndex(p => p.id === draggedPassId);
    
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedPassId(null);
      setDragOverIndex(null);
      return;
    }
    
    // Remove dragged item from its current position
    const [draggedItem] = currentPasses.splice(draggedIndex, 1);
    
    // Insert at new position
    currentPasses.splice(dropIndex, 0, draggedItem);
    
    // Update pass numbers based on new order
    const updatedPasses = currentPasses.map((pass, index) => ({
      ...pass,
      passNumber: `${index + 1}`
    }));
    
    // Optimistically update UI
    setTimelineData(prev => ({
      ...prev,
      [phase]: {
        passes: updatedPasses
      }
    }));
    
    // Save to API
    try {
      // Update all passes in the phase to maintain order
      const updatedData: TimelineData = {
        ...timelineData,
        [phase]: {
          passes: updatedPasses
        }
      };
      
      // Save entire phase data to maintain order
      await updateEdgeConfigPhase(phase, updatedPasses);
      setTimelineData(updatedData);
    } catch (err) {
      setError('Failed to reorder passes. Please try again.');
      // Revert on error
      setTimelineData(prev => ({
        ...prev,
        [phase]: {
          passes: currentPasses
        }
      }));
    }
    
    setDraggedPassId(null);
    setDragOverIndex(null);
  }

  async function updateEdgeConfigPhase(phase: Phase, passes: PassTile[]) {
    // Fetch current data
    const currentData = await fetchTimelineData();
    
    // Update the phase with new passes array
    const updatedData: TimelineData = {
      ...currentData,
      [phase]: {
        passes
      }
    };
    
    // Save to Edge Config
    const response = await fetch('/api/passes', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phase,
        passes // Send entire array to update order
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update pass order');
    }
    
    return await response.json();
  }

  // Render a single pass tile
  function renderPassTile(phase: Phase, pass: PassTile, index: number) {
    const isEditing = editingId === pass.id;
    const machineIcon = getMachineIcon(pass.machine);
    const isDragging = draggedPassId === pass.id;
    const isDragOver = dragOverIndex === index;
    
    return (
      <div 
        key={pass.id} 
        draggable
        onDragStart={(e) => {
          handleDragStart(phase, pass.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => handleDragOver(phase, index, e)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(phase, index);
        }}
        style={{
          ...styles.passTile,
          opacity: isDragging ? 0.5 : 1,
          border: isDragOver ? '2px dashed #4a7c59' : 'none',
          cursor: 'move',
        }}
      >
        {isEditing ? (
          <div style={styles.editForm}>
            <div style={styles.machineIconPlaceholder}>
              {machineIcon === 'spreader' && '🚜'}
              {machineIcon === 'planter' && '🌾'}
              {machineIcon === 'colter' && '🔧'}
            </div>
            <div style={styles.editFormFields}>
              <div style={styles.fieldRow}>
                <label style={styles.fieldLabel}>Machine:</label>
                <select
                  value={editForm.machine || ''}
                  onChange={(e) => setEditForm({ ...editForm, machine: e.target.value })}
                  style={styles.fieldSelect}
                >
                  <option value="">Select a machine</option>
                  {MACHINE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.fieldLabel}>VR RX:</label>
                <input
                  type="checkbox"
                  checked={editForm.vrRx || false}
                  onChange={(e) => setEditForm({ ...editForm, vrRx: e.target.checked })}
                  style={styles.checkboxInput}
                />
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.fieldLabel}>Nutrient types:</label>
                <select
                  value={editForm.nutrientTypes || ''}
                  onChange={(e) => setEditForm({ ...editForm, nutrientTypes: e.target.value })}
                  style={styles.fieldSelect}
                >
                  <option value="">Select nutrient types</option>
                  {NUTRIENT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.editActions}>
                <button
                  style={styles.saveButton}
                  onClick={() => saveEdit(phase)}
                >
                  Save
                </button>
                <button
                  style={styles.cancelButton}
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={styles.passTileHeader}>
              <div style={styles.passNumberBadge}>
                {index + 1}
              </div>
              <div style={styles.machineIconPlaceholder}>
                {machineIcon === 'spreader' && '🚜'}
                {machineIcon === 'planter' && '🌾'}
                {machineIcon === 'colter' && '🔧'}
              </div>
              <div style={styles.tileActions}>
                <button
                  style={styles.editIconButton}
                  onClick={() => startEdit(pass)}
                  title="Edit pass"
                >
                  ✏️
                </button>
                <button
                  style={styles.deleteIconButton}
                  onClick={() => handleDeletePass(phase, pass.id)}
                  title="Delete pass"
                >
                  🗑️
                </button>
              </div>
            </div>
            <div style={styles.passTileFields}>
              <div style={styles.fieldRow}>
                <label style={styles.fieldLabel}>Machine:</label>
                <input
                  type="text"
                  value={pass.machine || ''}
                  readOnly
                  style={styles.fieldInput}
                />
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.fieldLabel}>VR RX:</label>
                <input
                  type="checkbox"
                  checked={pass.vrRx || false}
                  readOnly
                  style={styles.checkboxInput}
                />
              </div>
              <div style={styles.fieldRow}>
                <label style={styles.fieldLabel}>Nutrient types:</label>
                <input
                  type="text"
                  value={pass.nutrientTypes || ''}
                  readOnly
                  style={styles.fieldInput}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  async function handleDeletePass(phase: Phase, passId: string) {
    const passToDelete = timelineData[phase].passes.find(p => p.id === passId);
    const isNewPass = unsavedPassIds.has(passId);
    
    // Optimistically update UI and renumber passes
    setTimelineData(prev => {
      const updatedPasses = prev[phase].passes
        .filter(pass => pass.id !== passId)
        .map((pass, index) => ({
          ...pass,
          passNumber: `${index + 1}`
        }));
      
      return {
        ...prev,
        [phase]: {
          passes: updatedPasses
        }
      };
    });
    
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
        // Renumber passes after deletion
        const renumberedData: TimelineData = {
          ...updatedData,
          [phase]: {
            passes: updatedData[phase].passes.map((pass, index) => ({
              ...pass,
              passNumber: `${index + 1}`
            }))
          }
        };
        setTimelineData(renumberedData);
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
        <h1 style={styles.title}>Fertilizer Philosophy</h1>
        <p style={styles.subtitle}>Define the principles that guide your fertilizer application</p>
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

      {/* Philosophy Inputs */}
      <div style={styles.philosophySection}>
        <div style={styles.philosophyCard}>
          <label style={styles.philosophyLabel}>Yield Goal</label>
          <textarea
            value={yieldGoal}
            onChange={(e) => {
              const newValue = e.target.value;
              setYieldGoal(newValue);
              
              // Clear existing timeout
              if (yieldGoalTimeoutRef.current) {
                clearTimeout(yieldGoalTimeoutRef.current);
              }
              
              // Debounce save
              yieldGoalTimeoutRef.current = setTimeout(() => {
                saveYieldGoal(newValue);
              }, 1000);
            }}
            placeholder="Enter your yield goal philosophy..."
            style={styles.philosophyTextarea}
            rows={4}
          />
        </div>
        <div style={styles.philosophyCard}>
          <label style={styles.philosophyLabel}>Nutrient Goals</label>
          <textarea
            value={nutrientGoals}
            onChange={(e) => {
              const newValue = e.target.value;
              setNutrientGoals(newValue);
              
              // Clear existing timeout
              if (nutrientGoalsTimeoutRef.current) {
                clearTimeout(nutrientGoalsTimeoutRef.current);
              }
              
              // Debounce save
              nutrientGoalsTimeoutRef.current = setTimeout(() => {
                saveNutrientGoals(newValue);
              }, 1000);
            }}
            placeholder="Enter your nutrient goals philosophy..."
            style={styles.philosophyTextarea}
            rows={4}
          />
        </div>
      </div>

      <div style={styles.timelineWrapper}>
        <div style={styles.timelineContainer}>
          {/* Pre-plant label above timeline */}
          <div style={styles.prePlantLabel}>
            <span style={styles.phaseLabelText}>Pre-plant</span>
          </div>

          {/* Timeline line */}
          <div style={styles.timelineLine}>
            <div style={styles.timelineArrowUp}>▲</div>
            <div style={styles.timelineLineInner}></div>
            <div style={styles.timelineLineInner}></div>
            <div style={styles.timelineArrowDown}>▼</div>
          </div>

          {/* Seedling icon beside the line */}
          <div style={styles.seedlingMarker}>
            <span style={styles.seedlingIcon}>🌱</span>
          </div>

          {/* Post-plant label below timeline */}
          <div style={styles.postPlantLabel}>
            <span style={styles.phaseLabelText}>Post-plant</span>
          </div>

          {/* Passes container */}
          <div style={styles.passesWrapper}>
            {/* Pre-plant phase */}
            <div style={styles.phaseSection}>
              <div style={styles.passesList}>
                {timelineData['pre-plant'].passes.map((pass, index) => (
                  <div key={pass.id}>
                    {index > 0 && <div style={styles.connectorPlus}>+</div>}
                    {renderPassTile('pre-plant', pass, index)}
                  </div>
                ))}
              </div>
            </div>

            {/* Post-plant phase */}
            <div style={styles.phaseSection}>
              <h3 style={styles.sectionTitle}>Typical Passes</h3>
              <div style={styles.passesList}>
                {timelineData['post-plant'].passes.map((pass, index) => (
                  <div key={pass.id}>
                    {index > 0 && <div style={styles.connectorPlus}>+</div>}
                    {renderPassTile('post-plant', pass, index)}
                  </div>
                ))}
              </div>
              <div style={styles.addPassContainer}>
                <button
                  style={styles.addPassButton}
                  onClick={() => addPass('post-plant')}
                  title="Add pass to Post-plant"
                >
                  + Add Pass
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #2d5016, #4a7c59)',
    padding: '40px 20px',
  },
  header: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: '30px 20px',
    margin: '0 auto 30px',
    maxWidth: 1200,
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  philosophySection: {
    maxWidth: 1200,
    margin: '0 auto 30px',
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  philosophyCard: {
    flex: '1 1 400px',
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: '25px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  },
  philosophyLabel: {
    display: 'block',
    color: '#2c3e50',
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '12px',
  },
  philosophyTextarea: {
    width: '100%',
    padding: '12px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    color: '#2c3e50',
    resize: 'vertical',
    transition: 'border-color 0.2s ease',
    minHeight: '100px',
  },
  title: {
    margin: '0 0 10px 0',
    color: '#2c3e50',
    fontSize: '28px',
    fontWeight: 600,
  },
  subtitle: {
    margin: 0,
    color: '#7f8c8d',
    fontSize: '16px',
  },
  timelineWrapper: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  timelineContainer: {
    display: 'flex',
    position: 'relative',
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '15px',
    padding: '40px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  },
  prePlantLabel: {
    position: 'absolute',
    left: '80px',
    top: '30px',
    transform: 'translateX(-50%)',
    zIndex: 2,
  },
  postPlantLabel: {
    position: 'absolute',
    left: '80px',
    bottom: '30px',
    transform: 'translateX(-50%)',
    zIndex: 2,
  },
  timelineLine: {
    position: 'absolute',
    left: '80px',
    top: '70px',
    bottom: '70px',
    width: '4px',
    background: '#888',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineArrowUp: {
    color: '#888',
    fontSize: '16px',
    marginBottom: '10px',
  },
  timelineLineInner: {
    flex: 1,
    width: '100%',
    background: '#888',
  },
  seedlingMarker: {
    position: 'absolute',
    left: '40px',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
  },
  seedlingIcon: {
    fontSize: '24px',
    display: 'block',
  },
  timelineArrowDown: {
    color: '#888',
    fontSize: '16px',
    marginTop: '10px',
  },
  passesWrapper: {
    flex: 1,
    marginLeft: '120px',
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
  },
  phaseSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sectionTitle: {
    margin: '0 0 15px 0',
    color: '#2c3e50',
    fontSize: '20px',
    fontWeight: 600,
  },
  addPassContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '10px',
  },
  phaseLabelText: {
    color: '#2c3e50',
    fontSize: '18px',
    fontWeight: 600,
  },
  passesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  connectorPlus: {
    textAlign: 'center',
    color: '#888',
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '5px 0',
  },
  passTile: {
    background: '#90EE90',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    gap: '15px',
    alignItems: 'flex-start',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    position: 'relative',
  },
  passNumberBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: '#2c3e50',
    color: 'white',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    zIndex: 10,
  },
  machineIconPlaceholder: {
    width: '50px',
    height: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    flexShrink: 0,
  },
  passTileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  passTileFields: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  editForm: {
    display: 'flex',
    gap: '15px',
    width: '100%',
  },
  editFormFields: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  fieldLabel: {
    color: '#2c3e50',
    fontSize: '14px',
    fontWeight: 500,
    minWidth: '100px',
    whiteSpace: 'nowrap',
  },
  fieldInput: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    background: 'white',
    fontSize: '14px',
    color: '#2c3e50',
    fontFamily: 'inherit',
  },
  fieldSelect: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    background: 'white',
    fontSize: '14px',
    color: '#2c3e50',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  checkboxInput: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#4a7c59',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#4a7c59',
  },
  tileActions: {
    display: 'flex',
    gap: '8px',
  },
  editIconButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background 0.2s ease',
  },
  deleteIconButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background 0.2s ease',
  },
  editActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
  },
  saveButton: {
    flex: 1,
    background: '#4a7c59',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px',
    transition: 'background 0.2s ease',
  },
  cancelButton: {
    flex: 1,
    background: '#e0e0e0',
    color: '#2c3e50',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px',
    transition: 'background 0.2s ease',
  },
  emptyPassSlot: {
    display: 'flex',
    justifyContent: 'center',
    padding: '20px',
  },
  addPassButton: {
    background: '#4a7c59',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px',
    transition: 'background 0.2s ease',
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

