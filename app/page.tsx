'use client';

import { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from './pageStyles';
import { FIELD_NAMES } from '../constants';
import FertilityTimeline from '../components/FertilityTimeline';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

type PageKey = 'fields' | 'yield' | 'nutrient-capacity' | 'nutrient-needed' | 'fertility-planning';

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

export default function Page() {
  const [currentField, setCurrentField] = useState<string>('');
  const [page, setPage] = useState<PageKey>('fields');
  const [nutrientCurrent, setNutrientCurrent] = useState<'n-current'|'p-current'|'k-current'>('n-current');
  const [nutrientNeeded, setNutrientNeeded] = useState<'n-needed'|'p-needed'|'k-needed'>('n-needed');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { yieldGoal?: File; soilSample?: File }>>({});
  
  // Generate random costs for each field (stored in state so they don't change on re-render)
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

  const selectedAttr = useMemo(() => {
    if (page === 'yield') return 'yield_target';
    if (page === 'nutrient-capacity') {
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
    setCurrentField(field);
    setPage('yield');
  }

  function goBack() {
    if (page === 'nutrient-needed') setPage('nutrient-capacity');
    else if (page === 'nutrient-capacity') setPage('yield');
    else if (page === 'yield') { setCurrentField(''); setPage('fields'); }
  }

  function goHome() {
    setCurrentField('');
    setPage('fields');
  }

  function handleFileUpload(fieldName: string, type: 'yieldGoal' | 'soilSample', event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFiles(prev => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          [type]: file
        }
      }));
    }
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

  return (
    <div style={styles.appRoot}>
      {page === 'fields' && (
        <div style={styles.container}> 
          <div style={styles.headerBox}>
            <h2 style={styles.headerTitle}>Field Management Dashboard</h2>
            <p style={styles.headerSub}>Select a field to create a fertilization plan</p>
          </div>
          <div style={styles.contentCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableTh}>Field Name</th>
                  <th style={styles.tableTh}>Yield Goal</th>
                  <th style={styles.tableTh}>Soil Sample</th>
                  <th style={styles.tableTh}>Plan</th>
                  <th style={styles.tableTh}>Maps</th>
                  <th style={styles.tableTh}>Total Cost</th>
                  <th style={styles.tableTh}>Cost per acre</th>
                  <th style={styles.tableTh}>Send map to machine</th>
                </tr>
              </thead>
              <tbody>
                {[[FIELD_NAMES.NORTH_OF_ROAD,'Corn'],[FIELD_NAMES.SOUTH_OF_ROAD,'Corn'],[FIELD_NAMES.RAILROAD_PIVOT,'Corn']].map(([name,crop]) => {
                  const fieldFiles = uploadedFiles[name] || {};
                  const costs = fieldCosts[name] || { total: 75000, perAcre: 150 };
                  return (
                    <tr key={name} style={styles.tableTr} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{...styles.tableTd, ...styles.fieldName}}>{name}</td>
                      <td style={styles.tableTd}>
                        <label style={{ display: 'inline-block', cursor: 'pointer' }}>
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls,.json"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileUpload(name, 'yieldGoal', e)}
                          />
                          <button 
                            style={{
                              ...styles.primaryBtn,
                              background: fieldFiles.yieldGoal ? '#27ae60' : 'linear-gradient(135deg,#2d5016,#4a7c59)',
                              padding: '8px 16px',
                              fontSize: '12px'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} 
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
                          >
                            {fieldFiles.yieldGoal ? '✓ Uploaded' : 'Upload'}
                          </button>
                        </label>
                      </td>
                      <td style={styles.tableTd}>
                        <label style={{ display: 'inline-block', cursor: 'pointer' }}>
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls,.json"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileUpload(name, 'soilSample', e)}
                          />
                          <button 
                            style={{
                              ...styles.primaryBtn,
                              background: fieldFiles.soilSample ? '#27ae60' : 'linear-gradient(135deg,#2d5016,#4a7c59)',
                              padding: '8px 16px',
                              fontSize: '12px'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} 
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
                          >
                            {fieldFiles.soilSample ? '✓ Uploaded' : 'Upload'}
                          </button>
                        </label>
                      </td>
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
                              color: '#7f8c8d',
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
                                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; 
                                }} 
                                onMouseLeave={(e) => { 
                                  e.currentTarget.style.transform = 'translateY(0)'; 
                                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; 
                                }}
                              >
                                {pass.passNumber}
                              </button>
                            ))
                          )}
                        </div>
                      </td>
                      <td style={styles.tableTd}>
                        <button style={styles.primaryBtn} onClick={() => createPlan(name)} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}>Generate Maps</button>
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
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} 
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
                        >
                          Send
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: '30px', textAlign: 'center' }}>
              <button 
                style={styles.primaryBtn} 
                onClick={() => setPage('fertility-planning')}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} 
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
              >
                View Fertility Planning Timeline
              </button>
            </div>
          </div>
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
          <FertilityTimeline />
        </div>
      )}

      {page !== 'fields' && page !== 'fertility-planning' && (
        <MapView
          page={page}
          currentField={currentField}
          selectedAttr={selectedAttr}
          nutrientCurrent={nutrientCurrent}
          nutrientNeeded={nutrientNeeded}
          onSetNutrientCurrent={setNutrientCurrent}
          onSetNutrientNeeded={setNutrientNeeded}
          onNext={() => setPage(page === 'yield' ? 'nutrient-capacity' : 'nutrient-needed')}
          onBack={goBack}
          onHome={goHome}
        />
      )}

      {/* Pass Info Popup */}
      {selectedPass && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedPass(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '15px',
              padding: '30px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              position: 'relative'
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
                color: '#7f8c8d',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ×
            </button>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#2c3e50',
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
                  color: '#7f8c8d',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '5px'
                }}>
                  Nutrient Types:
                </span>
                <span style={{
                  color: '#2c3e50',
                  fontSize: '16px',
                  fontWeight: 400
                }}>
                  {selectedPass.nutrientTypes || 'Not specified'}
                </span>
              </div>
              <div>
                <span style={{
                  color: '#7f8c8d',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '5px'
                }}>
                  VR RX:
                </span>
                <span style={{
                  color: '#2c3e50',
                  fontSize: '16px',
                  fontWeight: 400
                }}>
                  {selectedPass.vrRx ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span style={{
                  color: '#7f8c8d',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '5px'
                }}>
                  Machine:
                </span>
                <span style={{
                  color: '#2c3e50',
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

