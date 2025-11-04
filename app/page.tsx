'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import styles from './pageStyles';
import { FIELD_NAMES } from '../constants';
import FertilityTimeline from '../components/FertilityTimeline';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

type PageKey = 'fields' | 'yield' | 'nutrient-capacity' | 'nutrient-needed' | 'fertility-planning';

export default function Page() {
  const [currentField, setCurrentField] = useState<string>('');
  const [page, setPage] = useState<PageKey>('fields');
  const [nutrientCurrent, setNutrientCurrent] = useState<'n-current'|'p-current'|'k-current'>('n-current');
  const [nutrientNeeded, setNutrientNeeded] = useState<'n-needed'|'p-needed'|'k-needed'>('n-needed');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { yieldGoal?: File; soilSample?: File }>>({});

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
                  <th style={styles.tableTh}>Crop Type</th>
                  <th style={styles.tableTh}>Yield Goal</th>
                  <th style={styles.tableTh}>Soil Sample</th>
                  <th style={styles.tableTh}>Plan</th>
                  <th style={styles.tableTh}>Fertilization Plan</th>
                </tr>
              </thead>
              <tbody>
                {[[FIELD_NAMES.NORTH_OF_ROAD,'Corn'],[FIELD_NAMES.SOUTH_OF_ROAD,'Corn'],[FIELD_NAMES.RAILROAD_PIVOT,'Corn']].map(([name,crop]) => {
                  const fieldFiles = uploadedFiles[name] || {};
                  return (
                    <tr key={name} style={styles.tableTr} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{...styles.tableTd, ...styles.fieldName}}>{name}</td>
                      <td style={{...styles.tableTd, ...styles.cropType}}>{crop}</td>
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
                      <td style={styles.tableTd}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[1, 2, 3].map((num) => (
                            <button
                              key={num}
                              style={{
                                ...styles.primaryBtn,
                                padding: '8px 12px',
                                fontSize: '12px',
                                minWidth: '36px'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} 
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={styles.tableTd}>
                        <button style={styles.primaryBtn} onClick={() => createPlan(name)} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}>Create Plan</button>
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
    </div>
  );
}

