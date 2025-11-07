'use client';

import { useEffect, useMemo, useState } from 'react';

type Phase = 'pre-plant' | 'post-plant';

type PassTile = {
  id: string;
  passNumber: string;
  machine: string;
  nutrientTypes: string;
  vrRx: boolean;
};

type PhaseData = { passes: PassTile[] };

type TimelineData = Record<Phase, PhaseData>;

type CombinedPass = PassTile & {
  phase: Phase;
  globalNumber: number;
};

const DEFAULT_DATA: TimelineData = {
  'pre-plant': { passes: [] },
  'post-plant': { passes: [] }
};

function normaliseData(data: TimelineData): TimelineData {
  return {
    'pre-plant': {
      passes: (data['pre-plant']?.passes || [])
        .slice()
        .sort((a, b) => Number(a.passNumber) - Number(b.passNumber))
        .map((pass, idx) => ({ ...pass, passNumber: `${idx + 1}` }))
    },
    'post-plant': {
      passes: (data['post-plant']?.passes || [])
        .slice()
        .sort((a, b) => Number(a.passNumber) - Number(b.passNumber))
        .map((pass, idx) => ({ ...pass, passNumber: `${idx + 1}` }))
    }
  };
}

async function fetchTimelineData(): Promise<TimelineData> {
  const response = await fetch('/api/passes');
  if (!response.ok) {
    throw new Error('Failed to load passes');
  }
  const data = await response.json();
  return normaliseData(data || DEFAULT_DATA);
}

async function updatePass(phase: Phase, passId: string, updates: Partial<PassTile>): Promise<TimelineData> {
  const response = await fetch('/api/passes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase, passId, updates })
  });
  if (!response.ok) {
    throw new Error('Failed to update pass');
  }
  const data = await response.json();
  return normaliseData(data);
}

async function deletePass(phase: Phase, passId: string): Promise<TimelineData> {
  const response = await fetch(`/api/passes?phase=${phase}&passId=${passId}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete pass');
  }
  const data = await response.json();
  return normaliseData(data);
}

async function createPass(phase: Phase, pass: PassTile): Promise<TimelineData> {
  const response = await fetch('/api/passes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase, pass })
  });
  if (!response.ok) {
    throw new Error('Failed to create pass');
  }
  const data = await response.json();
  return normaliseData(data);
}

async function replacePhasePasses(phase: Phase, passes: PassTile[]): Promise<TimelineData> {
  const response = await fetch('/api/passes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase, passes })
  });
  if (!response.ok) {
    throw new Error('Failed to reorder passes');
  }
  const data = await response.json();
  return normaliseData(data);
}

export default function TypicalPasses() {
  const [timelineData, setTimelineData] = useState<TimelineData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PassTile>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [newPassStage, setNewPassStage] = useState<Phase>('pre-plant');
  const [newPassMachine, setNewPassMachine] = useState('');
  const [newPassNutrients, setNewPassNutrients] = useState('');
  const [newPassVr, setNewPassVr] = useState(false);
  const [addingPass, setAddingPass] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);
    fetchTimelineData()
      .then((data) => { if (mounted) setTimelineData(data); })
      .catch((err) => {
        console.error(err);
        if (mounted) setError('Unable to load passes. Please try again later.');
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const combinedPasses = useMemo<CombinedPass[]>(() => {
    const pre = (timelineData['pre-plant']?.passes || [])
      .sort((a, b) => Number(a.passNumber) - Number(b.passNumber))
      .map((pass) => ({ ...pass, phase: 'pre-plant' as Phase }));
    const post = (timelineData['post-plant']?.passes || [])
      .sort((a, b) => Number(a.passNumber) - Number(b.passNumber))
      .map((pass) => ({ ...pass, phase: 'post-plant' as Phase }));
    return [...pre, ...post].map((pass, idx) => ({ ...pass, globalNumber: idx + 1 }));
  }, [timelineData]);

  const beginEditing = (pass: CombinedPass) => {
    setEditingId(pass.id);
    setEditForm({ machine: pass.machine, nutrientTypes: pass.nutrientTypes, vrRx: pass.vrRx });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (pass: CombinedPass) => {
    if (!editForm.machine?.trim()) {
      setError('Machine name is required.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updatePass(pass.phase, pass.id, {
        machine: editForm.machine?.trim() || pass.machine,
        nutrientTypes: editForm.nutrientTypes?.trim() || '',
        vrRx: !!editForm.vrRx
      });
      setTimelineData(updated);
      cancelEditing();
    } catch (err) {
      console.error(err);
      setError('Failed to save pass.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (pass: CombinedPass) => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await deletePass(pass.phase, pass.id);
      setTimelineData(updated);
    } catch (err) {
      console.error(err);
      setError('Failed to delete pass.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newPassMachine.trim()) {
      setError('Please provide equipment details for the new pass.');
      return;
    }
    setIsSaving(true);
    setError(null);
    const existing = timelineData[newPassStage]?.passes || [];
    const newPass: PassTile = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pass-${Date.now()}`,
      passNumber: `${existing.length + 1}`,
      machine: newPassMachine.trim(),
      nutrientTypes: newPassNutrients.trim(),
      vrRx: newPassVr
    };
    try {
      const updated = await createPass(newPassStage, newPass);
      setTimelineData(updated);
      setAddingPass(false);
      setNewPassMachine('');
      setNewPassNutrients('');
      setNewPassVr(false);
    } catch (err) {
      console.error(err);
      setError('Failed to add new pass.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragStart = (passId: string) => {
    if (isSaving) return;
    setDraggingId(passId);
  };

  const handleDragEnter = (passId: string) => {
    if (passId === draggingId) return;
    setDragOverId(passId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === targetId || isSaving) {
      handleDragEnd();
      return;
    }

    const currentOrder = [...combinedPasses];
    const sourceIndex = currentOrder.findIndex((p) => p.id === draggingId);
    const targetIndex = currentOrder.findIndex((p) => p.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    const reordered = [...currentOrder];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setIsSaving(true);
    setError(null);

    try {
      const preCount = timelineData['pre-plant']?.passes.length || 0;
      let preCounter = 0;
      let postCounter = 0;
      const updatedCombined = reordered.map((pass, index) => {
        const phase: Phase = index < preCount ? 'pre-plant' : 'post-plant';
        const passNumber = phase === 'pre-plant' ? `${++preCounter}` : `${++postCounter}`;
        return { ...pass, phase, passNumber, globalNumber: index + 1 };
      });

      const toPassTile = (pass: CombinedPass): PassTile => ({
        id: pass.id,
        passNumber: pass.passNumber,
        machine: pass.machine,
        nutrientTypes: pass.nutrientTypes,
        vrRx: pass.vrRx
      });

      const updatedPre = updatedCombined.filter((pass) => pass.phase === 'pre-plant').map(toPassTile);
      const updatedPost = updatedCombined.filter((pass) => pass.phase === 'post-plant').map(toPassTile);

      await Promise.all([
        replacePhasePasses('pre-plant', updatedPre),
        replacePhasePasses('post-plant', updatedPost)
      ]);

      setTimelineData({
        'pre-plant': { passes: updatedPre },
        'post-plant': { passes: updatedPost }
      });
    } catch (err) {
      console.error(err);
      setError('Failed to reorder passes.');
    } finally {
      setIsSaving(false);
      handleDragEnd();
    }
  };

  return (
    <section
      style={{
        marginTop: '48px',
        background: 'rgba(6, 24, 13, 0.6)',
        border: '1px solid rgba(74, 222, 128, 0.25)',
        borderRadius: '20px',
        padding: '28px',
        boxShadow: '0 24px 60px rgba(22, 101, 52, 0.25)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', color: '#bbf7d0', margin: 0 }}>Typical passes</h2>
        </div>
        <button
          onClick={() => {
            setAddingPass((prev) => !prev);
            setError(null);
          }}
          style={{
            background: addingPass ? 'rgba(74, 222, 128, 0.35)' : 'rgba(34, 197, 94, 0.22)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            color: '#dcfce7',
            borderRadius: '999px',
            padding: '10px 18px',
            cursor: 'pointer',
            transition: 'background 0.2s ease'
          }}
        >
          {addingPass ? 'Close new pass form' : 'Add pass'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: '18px', color: 'rgba(248, 113, 113, 0.9)' }}>{error}</div>
      )}

      {addingPass && (
        <div
          style={{
            marginTop: '22px',
            background: 'rgba(6, 24, 13, 0.85)',
            border: '1px solid rgba(34, 197, 94, 0.32)',
            borderRadius: '16px',
            padding: '20px',
            display: 'grid',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <label style={{ color: '#bbf7d0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              Stage
              <select
                value={newPassStage}
                onChange={(event) => setNewPassStage(event.target.value as Phase)}
                style={{
                  background: 'rgba(12, 39, 22, 0.9)',
                  border: '1px solid rgba(34, 197, 94, 0.28)',
                  borderRadius: '10px',
                  color: '#f9fafb',
                  padding: '10px'
                }}
              >
                <option value="pre-plant">Closer to pre-plant</option>
                <option value="post-plant">Closer to post-plant</option>
              </select>
            </label>
            <label style={{ color: '#bbf7d0', flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              Equipment / machine
              <input
                value={newPassMachine}
                onChange={(event) => setNewPassMachine(event.target.value)}
                placeholder="e.g. 600R Spreader"
                style={{
                  background: 'rgba(12, 39, 22, 0.9)',
                  border: '1px solid rgba(34, 197, 94, 0.28)',
                  borderRadius: '10px',
                  color: '#f9fafb',
                  padding: '10px'
                }}
              />
            </label>
          </div>
          <label style={{ color: '#bbf7d0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            Nutrient mix
            <input
              value={newPassNutrients}
              onChange={(event) => setNewPassNutrients(event.target.value)}
              placeholder="DAP + Zinc"
              style={{
                background: 'rgba(12, 39, 22, 0.9)',
                border: '1px solid rgba(34, 197, 94, 0.28)',
                borderRadius: '10px',
                color: '#f9fafb',
                padding: '10px'
              }}
            />
          </label>
          <label style={{ color: '#bbf7d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={newPassVr}
              onChange={(event) => setNewPassVr(event.target.checked)}
            />
            Variable rate (VR) enabled
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              onClick={() => {
                setAddingPass(false);
                setNewPassMachine('');
                setNewPassNutrients('');
                setNewPassVr(false);
              }}
              style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                color: '#bbf7d0',
                borderRadius: '10px',
                padding: '10px 18px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isSaving}
              style={{
                background: 'linear-gradient(135deg, #34d399, #059669)',
                border: 'none',
                color: '#052e16',
                borderRadius: '10px',
                padding: '10px 22px',
                cursor: isSaving ? 'wait' : 'pointer',
                fontWeight: 600
              }}
            >
              {isSaving ? 'Saving…' : 'Save pass'}
            </button>
          </div>
        </div>
      )}

      {isLoading && !addingPass && (
        <div style={{ marginTop: '24px', color: 'rgba(209, 250, 229, 0.75)' }}>Loading typical passes…</div>
      )}

      {!isLoading && combinedPasses.length === 0 && !addingPass && (
        <div style={{ marginTop: '24px', color: 'rgba(209, 250, 229, 0.7)' }}>
          You haven’t saved any passes yet. Create the first one to outline your fertility workflow.
        </div>
      )}

      {!isLoading && combinedPasses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
          {combinedPasses.map((pass) => {
            const isEditing = editingId === pass.id;
            return (
              <div
                key={pass.id}
                draggable={!isEditing && !isSaving}
                onDragStart={() => handleDragStart(pass.id)}
                onDragEnter={() => handleDragEnter(pass.id)}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, pass.id)}
                onDragEnd={handleDragEnd}
                style={{
                  background: 'rgba(6, 24, 13, 0.9)',
                  border: dragOverId === pass.id && draggingId !== pass.id
                    ? '1px solid rgba(74, 222, 128, 0.65)'
                    : '1px solid rgba(34, 197, 94, 0.32)',
                  boxShadow: draggingId === pass.id ? '0 0 18px rgba(34, 197, 94, 0.35)' : 'none',
                  opacity: draggingId === pass.id ? 0.7 : 1,
                  borderRadius: '16px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: isEditing ? 'default' : 'grab'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{
                      background: 'rgba(34, 197, 94, 0.22)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      color: '#bbf7d0',
                      borderRadius: '999px',
                      padding: '6px 14px',
                      fontSize: '0.95rem'
                    }}>
                      Pass {pass.globalNumber}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => (isEditing ? handleSave(pass) : beginEditing(pass))}
                      disabled={isSaving && isEditing}
                      style={{
                        background: isEditing ? 'linear-gradient(135deg, #34d399, #059669)' : 'rgba(34, 197, 94, 0.18)',
                        border: '1px solid rgba(34, 197, 94, 0.32)',
                        color: '#dcfce7',
                        borderRadius: '10px',
                        padding: '8px 16px',
                        cursor: 'pointer'
                      }}
                    >
                      {isEditing ? (isSaving ? 'Saving…' : 'Save') : 'Edit'}
                    </button>
                    {isEditing ? (
                      <button
                        onClick={cancelEditing}
                        style={{
                          background: 'rgba(34, 197, 94, 0.1)',
                          border: '1px solid rgba(34, 197, 94, 0.25)',
                          color: '#bbf7d0',
                          borderRadius: '10px',
                          padding: '8px 16px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDelete(pass)}
                        disabled={isSaving}
                        style={{
                          background: 'rgba(248, 113, 113, 0.18)',
                          border: '1px solid rgba(248, 113, 113, 0.35)',
                          color: '#fee2e2',
                          borderRadius: '10px',
                          padding: '8px 16px',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <label style={{ color: '#bbf7d0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    Equipment / machine
                    <input
                      disabled={!isEditing}
                      value={isEditing ? editForm.machine ?? '' : pass.machine}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, machine: event.target.value }))}
                      style={{
                        background: 'rgba(12, 39, 22, 0.9)',
                        border: '1px solid rgba(34, 197, 94, 0.28)',
                        borderRadius: '10px',
                        color: '#f9fafb',
                        padding: '10px'
                      }}
                    />
                  </label>
                  <label style={{ color: '#bbf7d0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    Nutrient mix
                    <input
                      disabled={!isEditing}
                      value={isEditing ? editForm.nutrientTypes ?? '' : pass.nutrientTypes}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, nutrientTypes: event.target.value }))}
                      style={{
                        background: 'rgba(12, 39, 22, 0.9)',
                        border: '1px solid rgba(34, 197, 94, 0.28)',
                        borderRadius: '10px',
                        color: '#f9fafb',
                        padding: '10px'
                      }}
                    />
                  </label>
                </div>

                <label style={{ color: '#bbf7d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    disabled={!isEditing}
                    checked={isEditing ? !!editForm.vrRx : pass.vrRx}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, vrRx: event.target.checked }))}
                  />
                  Variable rate (VR) enabled
                </label>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
