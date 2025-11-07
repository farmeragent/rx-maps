'use client';

import { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from '../pageStyles';
import { FIELD_NAMES } from '../../constants';
import FertilityTimeline from '../../components/FertilityTimeline';

const MapView = dynamic(() => import('../../components/MapView'), { ssr: false });

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
  const [currentField, setCurrentField] = useState<string>('');
  const [page, setPage] = useState<PageKey>('fields');
  const [nutrientCurrent, setNutrientCurrent] = useState<'n-current'|'p-current'|'k-current'>('n-current');
  const [nutrientNeeded, setNutrientNeeded] = useState<'n-needed'|'p-needed'|'k-needed'>('n-needed');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { yieldGoal?: File; soilSample?: File }>>({});
  const [fieldUploadStatus, setFieldUploadStatus] = useState<Record<string, { yieldGoal: boolean; soilSample: boolean }>>({});
  
  const generateRandomFieldCost = () => {
    const total = Math.floor(Math.random() * (100000 - 50000 + 1)) + 50000;
    const perAcre = parseFloat((Math.random() * (200 - 100) + 100).toFixed(2));
    return { total, perAcre };
  };

  const createEmptyPassCosts = () => ({
    '1': { total: 0, perAcre: 0 },
    '2': { total: 0, perAcre: 0 },
    '3': { total: 0, perAcre: 0 }
  });

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

  const [northCostSummary, setNorthCostSummary] = useState<{ totalCost: number; costPerAcre: number } | null>(null);
  const [northFertilizerBreakdown, setNorthFertilizerBreakdown] = useState<{
    dap: { totalCost: number; costPerAcre: number };
    kno3: { totalCost: number; costPerAcre: number };
    urea: { totalCost: number; costPerAcre: number };
  } | null>(null);

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
    setCurrentField(field);
    setPage('yield');
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

  async function handleFileUpload(fieldName: string, type: 'yieldGoal' | 'soilSample', event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFiles(prev => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          [type]: file
        }
      }));
      
      // Update Edge Config
      try {
        const response = await fetch('/api/field-uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fieldName,
            uploadType: type,
            uploaded: true
          })
        });
        
        if (response.ok) {
          const updatedStatus = await response.json();
          setFieldUploadStatus(updatedStatus);
        }
      } catch (error) {
        console.error('Error updating upload status:', error);
      }
    }
  }
  
  function viewYieldGoal(fieldName: string) {
    setCurrentField(fieldName);
    setPage('yield-view');
  }
  
  function viewSoilSample(fieldName: string) {
    setCurrentField(fieldName);
    setPage('nutrient-capacity-view');
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
  
  // Fetch field upload status from Edge Config
  useEffect(() => {
    async function fetchUploadStatus() {
      try {
        const response = await fetch('/api/field-uploads');
        if (response.ok) {
          const status = await response.json();
          setFieldUploadStatus(status);
        }
      } catch (error) {
        console.error('Error fetching upload status:', error);
      }
    }
    
    if (page === 'fields') {
      fetchUploadStatus();
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
                  <th style={{...styles.tableTh, width: '40px', textAlign: 'center'}}></th>
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
                  const isExpanded = expandedRow === name;
                  const fieldPassCosts = passCosts[name] || {};
                  const uploadStatus = fieldUploadStatus[name] || { yieldGoal: false, soilSample: false };
                  const hasYieldGoal = uploadStatus.yieldGoal || fieldFiles.yieldGoal;
                  const hasSoilSample = uploadStatus.soilSample || fieldFiles.soilSample;
                  return (
                    <>
                      <tr 
                        key={name} 
                        style={{
                          ...styles.tableTr,
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? '#e8f5e9' : 'transparent'
                        }} 
                        onClick={(e) => {
                          // Don't toggle if clicking on buttons or interactive elements
                          if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('label')) {
                            return;
                          }
                          setExpandedRow(isExpanded ? null : name);
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }} 
                        onMouseLeave={(e) => {
                          if (!isExpanded) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                      <td style={{...styles.tableTd, textAlign: 'center', width: '40px', padding: '12px'}}>
                        <span style={{ 
                          fontSize: '14px', 
                          color: '#4a7c59',
                          transition: 'transform 0.2s ease',
                          display: 'inline-block',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                        }}>
                          ▶
                        </span>
                      </td>
                      <td style={{...styles.tableTd, ...styles.fieldName}}>{name}</td>
                      <td style={styles.tableTd}>
                        {hasYieldGoal ? (
                          <button 
                            style={{
                              ...styles.primaryBtn,
                              background: '#27ae60',
                              padding: '8px 16px',
                              fontSize: '12px'
                            }}
                            onClick={() => viewYieldGoal(name)}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} 
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
                          >
                            View
                          </button>
                        ) : (
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
                                background: 'linear-gradient(135deg,#2d5016,#4a7c59)',
                                padding: '8px 16px',
                                fontSize: '12px'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} 
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
                            >
                              Upload
                            </button>
                          </label>
                        )}
                      </td>
                      <td style={styles.tableTd}>
                        {hasSoilSample ? (
                          <button 
                            style={{
                              ...styles.primaryBtn,
                              background: '#27ae60',
                              padding: '8px 16px',
                              fontSize: '12px'
                            }}
                            onClick={() => viewSoilSample(name)}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} 
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
                          >
                            View
                          </button>
                        ) : (
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
                                background: 'linear-gradient(135deg,#2d5016,#4a7c59)',
                                padding: '8px 16px',
                                fontSize: '12px'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} 
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
                            >
                              Upload
                            </button>
                          </label>
                        )}
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
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0, backgroundColor: '#f8f9fa', borderTop: '2px solid #4a7c59' }}>
                          <div style={{ padding: '20px', backgroundColor: '#f8f9fa' }}>
                            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '18px' }}>Pass Breakdown for {name}</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#4a7c59', color: '#fff' }}>
                                  <th style={{ ...styles.tableTh, backgroundColor: '#4a7c59', color: '#fff', textAlign: 'left', padding: '12px 16px' }}>Pass</th>
                                  <th style={{ ...styles.tableTh, backgroundColor: '#4a7c59', color: '#fff', textAlign: 'left', padding: '12px 16px' }}>Machine</th>
                                  <th style={{ ...styles.tableTh, backgroundColor: '#4a7c59', color: '#fff', textAlign: 'left', padding: '12px 16px' }}>Nutrients</th>
                                  <th style={{ ...styles.tableTh, backgroundColor: '#4a7c59', color: '#fff', textAlign: 'right', padding: '12px 16px' }}>Total Cost</th>
                                  <th style={{ ...styles.tableTh, backgroundColor: '#4a7c59', color: '#fff', textAlign: 'right', padding: '12px 16px' }}>Cost per acre</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allPasses.map((pass) => {
                                  const passCost = fieldPassCosts[pass.passNumber] || { total: 25000, perAcre: 50 };
                                  return (
                                    <tr key={pass.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                                      <td style={{ ...styles.tableTd, fontWeight: 600, color: '#2c3e50' }}>Pass {pass.passNumber}</td>
                                      <td style={styles.tableTd}>{pass.machine}</td>
                                      <td style={styles.tableTd}>{pass.nutrientTypes}</td>
                                      <td style={{ ...styles.tableTd, textAlign: 'right', fontWeight: 600, color: '#2d5016' }}>
                                        ${passCost.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </td>
                                      <td style={{ ...styles.tableTd, textAlign: 'right', fontWeight: 600, color: '#2d5016' }}>
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
          hideNavigation={false}
          hideNextBack={page === 'yield-view' || page === 'nutrient-capacity-view'}
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

