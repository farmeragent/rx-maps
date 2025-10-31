'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import styles from './pageStyles';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

type PageKey = 'fields' | 'yield' | 'nutrient-capacity' | 'nutrient-needed';

export default function Page() {
  const [currentField, setCurrentField] = useState<string>('');
  const [page, setPage] = useState<PageKey>('fields');
  const [nutrientCurrent, setNutrientCurrent] = useState<'n-current'|'p-current'|'k-current'>('n-current');
  const [nutrientNeeded, setNutrientNeeded] = useState<'n-needed'|'p-needed'|'k-needed'>('n-needed');

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
                  <th style={styles.tableTh}>Fertilization Plan</th>
                </tr>
              </thead>
              <tbody>
                {[['North of Road','Corn'],['South of Road','Corn'],['Railroad Pivot','Corn']].map(([name,crop]) => (
                  <tr key={name} style={styles.tableTr} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{...styles.tableTd, ...styles.fieldName}}>{name}</td>
                    <td style={{...styles.tableTd, ...styles.cropType}}>{crop}</td>
                    <td style={styles.tableTd}>
                      <button style={styles.primaryBtn} onClick={() => createPlan(name)} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}>Create Plan</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {page !== 'fields' && (
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

