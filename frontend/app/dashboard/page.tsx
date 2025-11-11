'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../pageStyles';
import { FIELD_NAMES, THEME } from '../../constants';
import ChatSidebar from '../../components/ChatSidebar';
import { usePersistentChat } from '../../hooks/usePersistentChat';
import { DEFAULT_CHAT_MESSAGES } from '../../constants';
type PageKey = 'fields' | 'yield' | 'nutrient-capacity' | 'nutrient-needed' | 'fertility-planning' | 'yield-view' | 'nutrient-capacity-view';

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

export default function DashboardPage() {
  const router = useRouter();
  const {
    messages: chatMessages,
    setMessages: setChatMessages,
    resetMessages: resetChatMessages
  } = usePersistentChat({ initialMessages: DEFAULT_CHAT_MESSAGES });
  const [chatInputValue, setChatInputValue] = useState('');
  const [isChatFullWidth, setIsChatFullWidth] = useState(false);
  const [currentField, setCurrentField] = useState<string>('');
  const [page, setPage] = useState<PageKey>('fields');
  const [nutrientCurrent, setNutrientCurrent] = useState<'n-current'|'p-current'|'k-current'>('n-current');
  const [nutrientNeeded, setNutrientNeeded] = useState<'n-needed'|'p-needed'|'k-needed'>('n-needed');
  const handleChatSubmit = () => {
    const question = chatInputValue.trim();
    if (!question) {
      return;
    }

    setChatInputValue('');
    setIsChatFullWidth(false);
    router.push(`/hex-query?question=${encodeURIComponent(question)}`);
  };

  const handleChatClearHistory = () => {
    resetChatMessages();
    setChatInputValue('');
    setIsChatFullWidth(false);
  };

  const handleChatToggleWidth = () => {
    setIsChatFullWidth((prev) => !prev);
  };

  const clearChatActionsById = (actionId?: string) => {
    if (!actionId) {
      return;
    }

    setChatMessages((prev) =>
      prev.map((message) =>
        message.actionId === actionId ? { ...message, actions: undefined } : message
      )
    );
  };

  const handleChatAction = (value: string, actionId?: string) => {
    if (actionId && actionId !== 'dashboard-link') {
      clearChatActionsById(actionId);
    }

    if (value === 'open_dashboard') {
      setIsChatFullWidth(false);
      return;
    }

    if (value === 'generate_all_prescriptions') {
      setIsChatFullWidth(false);
      router.push('/hex-query?question=Generate%20prescription%20maps%20for%20all%20fields');
      return;
    }

    if (value === 'skip_generate_all') {
      setIsChatFullWidth(false);
      router.push('/hex-query');
      return;
    }

    setIsChatFullWidth(false);
    router.push(`/hex-query?question=${encodeURIComponent(value)}`);
  };

  const [fieldCosts] = useState<Record<string, { total: number; perAcre: number }>>(() => {
    const costs: Record<string, { total: number; perAcre: number }> = {};
    [FIELD_NAMES.NORTH_OF_ROAD, FIELD_NAMES.SOUTH_OF_ROAD, FIELD_NAMES.RAILROAD_PIVOT].forEach(field => {
      const total = Math.floor(Math.random() * (100000 - 50000 + 1)) + 50000;
      const perAcre = Math.floor(Math.random() * (200 - 100 + 1)) + 100;
      costs[field] = { total, perAcre };
    });
    return costs;
  });
  const [allPasses, setAllPasses] = useState<PassTile[]>([]);
  const [selectedPass, setSelectedPass] = useState<PassTile | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  const [passCosts] = useState<Record<string, Record<string, { total: number; perAcre: number }>>>(() => {
    const passCostsMap: Record<string, Record<string, { total: number; perAcre: number }>> = {};
    [FIELD_NAMES.NORTH_OF_ROAD, FIELD_NAMES.SOUTH_OF_ROAD, FIELD_NAMES.RAILROAD_PIVOT].forEach(field => {
      const fieldPassCosts: Record<string, { total: number; perAcre: number }> = {};
      for (let i = 1; i <= 3; i++) {
        const total = Math.floor(Math.random() * (35000 - 15000 + 1)) + 15000;
        const perAcre = Math.floor(Math.random() * (70 - 30 + 1)) + 30;
        fieldPassCosts[`${i}`] = { total, perAcre };
      }
      passCostsMap[field] = fieldPassCosts;
    });
    return passCostsMap;
  });

  const [dynamicColumns, setDynamicColumns] = useState<string[]>([]);
  const [dynamicFieldValues, setDynamicFieldValues] = useState<Record<string, Record<string, any>>>({});
  const [dynamicQuestion, setDynamicQuestion] = useState<string | null>(null);

  const formatColumnHeading = (column: string) =>
    column
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const selectedAttr = useMemo(() => {
    if (page === 'yield' || page === 'yield-view') return 'yield_target';
    if (page === 'nutrient-capacity' || page === 'nutrient-capacity-view') {
      if (nutrientCurrent === 'n-current') return 'N_in_soil';
      if (nutrientCurrent === 'p-current') return 'P_in_soil';
      return 'K_in_soil';
    }
    if (page === 'nutrient-needed') {
      if (nutrientNeeded === 'n-needed') return 'N_to_apply';
      if (nutrientNeeded === 'p-needed') return 'P_to_apply';
      return 'K_to_apply';
    }
    return null;
  }, [page, nutrientCurrent, nutrientNeeded]);

  function createPlan(field: string) {
    router.push(`/hex-query?prescriptionField=${encodeURIComponent(field)}`);
  }

  function goBack() {
    if (page === 'nutrient-needed') setPage('nutrient-capacity');
    else if (page === 'nutrient-capacity') setPage('yield');
    else if (page === 'yield') { setCurrentField(''); setPage('fields'); }
    else if (page === 'yield-view' || page === 'nutrient-capacity-view') { setCurrentField(''); setPage('fields'); }
  }

  function goHome() {
    setCurrentField('');
    setPage('fields');
  }

  // Fetch all passes from Edge Config
  useEffect(() => {
    async function fetchPasses() {
      try {
        const response = await fetch('/api/passes');
        if (!response.ok) {
          throw new Error('Failed to fetch passes');
        }
        const data: TimelineData = await response.json();
        
        // Flatten all passes from all phases into a single array
        const passes: PassTile[] = [
          ...(data['pre-plant']?.passes || []),
          ...(data['post-plant']?.passes || [])
        ];
        
        setAllPasses(passes);
      } catch (error) {
        console.error('Error fetching passes:', error);
        setAllPasses([]);
      }
    }

    // Fetch on mount and when returning to fields page
    if (page === 'fields') {
      fetchPasses();
    }
  }, [page]);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('dashboardDynamic');
    if (!stored) return;

    try {
      const payload = JSON.parse(stored);
      const rows = Array.isArray(payload?.results) ? payload.results : [];
      const question = typeof payload?.question === 'string' ? payload.question : null;

      const fieldValues: Record<string, Record<string, any>> = {};
      const columnSet = new Set<string>();

      rows.forEach((row: any) => {
        if (!row || typeof row !== 'object') return;
        const rawFieldName = row.field_name || row.field || row.name || row.Field || row.Field_Name;
        if (!rawFieldName) return;
        const canonicalField = Object.values(FIELD_NAMES).find(
          (value) => value.toLowerCase() === String(rawFieldName).toLowerCase()
        );
        if (!canonicalField) return;

        const mapped: Record<string, any> = { ...fieldValues[canonicalField] };
        Object.entries(row).forEach(([key, value]) => {
          if (['field_name', 'field', 'name', 'Field', 'Field_Name'].includes(key)) return;
          columnSet.add(key);
          mapped[key] = value;
        });
        fieldValues[canonicalField] = mapped;
      });

      setDynamicColumns(Array.from(columnSet));
      setDynamicFieldValues(fieldValues);
      setDynamicQuestion(question);
      sessionStorage.removeItem('dashboardDynamic');
      setPage('fields');
      setCurrentField('');
    } catch (error) {
      console.error('Failed to parse dashboard dynamic data:', error);
      sessionStorage.removeItem('dashboardDynamic');
    }
  }, []);

  return (
    <div style={styles.appRoot}>
      {page === 'fields' && (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <ChatSidebar
            messages={chatMessages}
            inputValue={chatInputValue}
            onInputChange={setChatInputValue}
            onSubmit={handleChatSubmit}
            onClearHistory={handleChatClearHistory}
            onToggleWidth={handleChatToggleWidth}
            isLoading={false}
            isFullWidth={isChatFullWidth}
            hasShownMap
            onAction={handleChatAction}
          />
          {!isChatFullWidth && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={styles.container}> 
          <div style={styles.headerBox}>
            <h2 style={styles.headerTitle}>Field Management Dashboard</h2>
            <p style={styles.headerSub}>Select a field to create a fertilization plan</p>
            {dynamicQuestion && (
              <p style={{ ...styles.headerSub, marginTop: '12px', fontStyle: 'italic', color: THEME.ACCENT.TEXT_ACCENT }}>
                Assistant query: {dynamicQuestion}
              </p>
            )}
          </div>
          <div style={styles.contentCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{...styles.tableTh, width: '40px', textAlign: 'center'}}></th>
                  <th style={styles.tableTh}>Field Name</th>
                  {dynamicColumns.length === 0 && (
                    <>
                      <th style={styles.tableTh}>Passes</th>
                      <th style={styles.tableTh}>Rx Maps</th>
                      <th style={styles.tableTh}>Total Cost</th>
                      <th style={styles.tableTh}>Cost per acre</th>
                      <th style={styles.tableTh}>Send map to machine</th>
                    </>
                  )}
                  {dynamicColumns.map((column) => (
                    <th key={column} style={styles.tableTh}>{formatColumnHeading(column)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[FIELD_NAMES.NORTH_OF_ROAD, FIELD_NAMES.SOUTH_OF_ROAD, FIELD_NAMES.RAILROAD_PIVOT].map((name) => {
                  const costs = fieldCosts[name] || { total: 75000, perAcre: 150 };
                  const isExpanded = expandedRow === name;
                  const fieldPassCosts = passCosts[name] || {};
                  const dynamicValues = dynamicFieldValues[name] || {};
                  return (
                    <>
                      <tr 
                        key={name} 
                        style={{
                          ...styles.tableTr,
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? THEME.BACKGROUND.ROW_ACTIVE : 'transparent'
                        }} 
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('label')) {
                            return;
                          }
                          setExpandedRow(isExpanded ? null : name);
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) e.currentTarget.style.backgroundColor = THEME.BACKGROUND.ROW_HOVER;
                        }} 
                        onMouseLeave={(e) => {
                          if (!isExpanded) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                      <td style={{...styles.tableTd, textAlign: 'center', width: '40px', padding: '12px'}}>
                        <span style={{ 
                          fontSize: '14px', 
                          color: THEME.ACCENT.TEXT_ACCENT,
                          transition: 'transform 0.2s ease',
                          display: 'inline-block',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                        }}>
                          ▶
                        </span>
                      </td>
                      <td style={{...styles.tableTd, ...styles.fieldName}}>{name}</td>
                      {dynamicColumns.length === 0 && (
                        <>
                          <td style={{...styles.tableTd, textAlign: 'left'}}>
                            <div style={{ 
                              display: 'flex', 
                              flexWrap: 'wrap',
                              gap: '8px',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                              minHeight: '32px'
                            }}>
                              {allPasses.length === 0 ? (
                                <span style={{
                                  fontSize: '14px',
                                  color: THEME.ACCENT.TEXT_MUTED,
                                  fontStyle: 'italic'
                                }}>
                                  No passes
                                </span>
                              ) : (
                                allPasses.map((pass) => (
                                  <button
                                    key={pass.id}
                                    style={{
                                      ...styles.primaryBtn,
                                      padding: '8px 12px',
                                      fontSize: '12px',
                                      minWidth: '40px',
                                      position: 'relative'
                                    }}
                                    onClick={() => setSelectedPass(pass)}
                                    onMouseEnter={(e) => { 
                                      e.currentTarget.style.transform = 'translateY(-1px)'; 
                                      e.currentTarget.style.boxShadow = THEME.SHADOW.LIFT_HOVER; 
                                    }} 
                                    onMouseLeave={(e) => { 
                                      e.currentTarget.style.transform = 'translateY(0)'; 
                                      e.currentTarget.style.boxShadow = THEME.SHADOW.LIFT; 
                                    }}
                                  >
                                    {pass.passNumber}
                                  </button>
                                ))
                              )}
                            </div>
                          </td>
                          <td style={styles.tableTd}>
                            <button
                              style={styles.primaryBtn}
                              onClick={() => createPlan(name)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = THEME.SHADOW.LIFT_HOVER;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = THEME.SHADOW.LIFT;
                              }}
                            >
                              View Rx
                            </button>
                          </td>
                          <td style={styles.tableTd}>
                            ${costs.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                          <td style={styles.tableTd}>
                            ${costs.perAcre.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={styles.tableTd}>
                            <button 
                              style={{
                                ...styles.primaryBtn,
                                padding: '8px 16px',
                                fontSize: '12px'
                              }}
                              onMouseEnter={(e) => { 
                                e.currentTarget.style.transform = 'translateY(-1px)'; 
                                e.currentTarget.style.boxShadow = THEME.SHADOW.LIFT_HOVER; 
                              }} 
                              onMouseLeave={(e) => { 
                                e.currentTarget.style.transform = 'translateY(0)'; 
                                e.currentTarget.style.boxShadow = THEME.SHADOW.LIFT; 
                              }}
                            >
                              Send
                            </button>
                          </td>
                        </>
                      )}
                      {dynamicColumns.map((column) => {
                        const value = dynamicValues[column];
                        const displayValue =
                          value === null || value === undefined
                            ? '—'
                            : typeof value === 'number'
                              ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
                              : String(value);
                        return (
                          <td key={`${name}-${column}`} style={styles.tableTd}>
                            {displayValue}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7 + dynamicColumns.length} style={{ padding: 0, backgroundColor: THEME.BACKGROUND.SURFACE_ELEVATED, borderTop: THEME.BORDER.MEDIUM }}>
                          <div style={{ padding: '24px', backgroundColor: THEME.BACKGROUND.SURFACE_ELEVATED }}>
                            <h3 style={{ margin: '0 0 18px 0', color: '#f9fafb', fontSize: '18px', letterSpacing: '0.01em' }}>Pass Breakdown for {name}</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: THEME.BACKGROUND.PANEL_DEEP, borderRadius: '14px', overflow: 'hidden', border: THEME.BORDER.INNER_CARD, boxShadow: THEME.SHADOW.PANEL }}>
                              <thead>
                                <tr style={{ backgroundColor: THEME.BACKGROUND.PASS_HEADER, color: '#f9fafb' }}>
                                  <th style={{ ...styles.tableTh, backgroundColor: 'transparent', color: '#f9fafb', textAlign: 'left', padding: '12px 16px', borderBottom: 'none' }}>Pass</th>
                                  <th style={{ ...styles.tableTh, backgroundColor: 'transparent', color: '#f9fafb', textAlign: 'left', padding: '12px 16px', borderBottom: 'none' }}>Machine</th>
                                  <th style={{ ...styles.tableTh, backgroundColor: 'transparent', color: '#f9fafb', textAlign: 'left', padding: '12px 16px', borderBottom: 'none' }}>Nutrients</th>
                                  <th style={{ ...styles.tableTh, backgroundColor: 'transparent', color: '#f9fafb', textAlign: 'right', padding: '12px 16px', borderBottom: 'none' }}>Total Cost</th>
                                  <th style={{ ...styles.tableTh, backgroundColor: 'transparent', color: '#f9fafb', textAlign: 'right', padding: '12px 16px', borderBottom: 'none' }}>Cost per acre</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allPasses.map((pass) => {
                                  const passCost = fieldPassCosts[pass.passNumber] || { total: 25000, perAcre: 50 };
                                  return (
                                    <tr key={pass.id} style={{ borderBottom: THEME.BORDER.INNER_CARD }}>
                                      <td style={{ ...styles.tableTd, fontWeight: 600, color: '#f9fafb' }}>Pass {pass.passNumber}</td>
                                      <td style={styles.tableTd}>{pass.machine}</td>
                                      <td style={styles.tableTd}>{pass.nutrientTypes}</td>
                                      <td style={{ ...styles.tableTd, textAlign: 'right', fontWeight: 600, color: THEME.ACCENT.TEXT_ACCENT }}>
                                        ${passCost.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </td>
                                      <td style={{ ...styles.tableTd, textAlign: 'right', fontWeight: 600, color: THEME.ACCENT.TEXT_ACCENT }}>
                                        ${passCost.perAcre.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
          )}
        </div>
      )}

      {page === 'fertility-planning' && (
        <div>
          <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 100 }}>
            <button 
              style={styles.primaryBtn} 
              onClick={() => setPage('fields')}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} 
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
            >
              ← Back to Fields
            </button>
          </div>
        </div>
      )}

      {/* MapView removed */}

      {selectedPass && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: THEME.BACKGROUND.OVERLAY_DIM,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedPass(null)}
        >
          <div 
            style={{
              background: THEME.BACKGROUND.MODAL,
              borderRadius: '18px',
              padding: '32px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: THEME.SHADOW.MODAL,
              position: 'relative',
              border: THEME.BORDER.MODAL
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPass(null)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: THEME.ACCENT.TEXT_MUTED,
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = THEME.BACKGROUND.CARD_TINT;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ×
            </button>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#f9fafb',
              fontSize: '24px',
              fontWeight: 600
            }}>
              {selectedPass.passNumber}
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}>
              <div>
                <span style={{
                  color: THEME.ACCENT.TEXT_MUTED,
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '5px'
                }}>
                  Nutrient Types:
                </span>
                <span style={{
                  color: '#f9fafb',
                  fontSize: '16px',
                  fontWeight: 400
                }}>
                  {selectedPass.nutrientTypes || 'Not specified'}
                </span>
              </div>
              <div>
                <span style={{
                  color: THEME.ACCENT.TEXT_MUTED,
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '5px'
                }}>
                  VR RX:
                </span>
                <span style={{
                  color: '#f9fafb',
                  fontSize: '16px',
                  fontWeight: 400
                }}>
                  {selectedPass.vrRx ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span style={{
                  color: THEME.ACCENT.TEXT_MUTED,
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '5px'
                }}>
                  Machine:
                </span>
                <span style={{
                  color: '#f9fafb',
                  fontSize: '16px',
                  fontWeight: 400
                }}>
                  {selectedPass.machine || 'Not specified'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

