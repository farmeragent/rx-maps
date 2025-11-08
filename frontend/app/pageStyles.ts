const styles: Record<string, React.CSSProperties> = {
  appRoot: { minHeight: '100vh', background: 'linear-gradient(135deg,#2d5016,#4a7c59)' },
  container: { maxWidth: 1400, margin: '0 auto', padding: 20 },
  headerBox: { 
    background: 'rgba(255,255,255,0.95)', 
    borderRadius: 15, 
    padding: '30px 20px', 
    margin: '20px 0', 
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    textAlign: 'center' 
  },
  headerTitle: { margin: '0 0 10px 0', color: '#2c3e50', fontSize: '28px', fontWeight: 600 },
  headerSub: { margin: 0, color: '#7f8c8d', fontSize: '16px' },
  contentCard: { background: 'rgba(255,255,255,0.95)', borderRadius: 15, padding: 30, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' },
  table: { 
    width: '100%', 
    borderCollapse: 'collapse',
    fontSize: '16px'
  },
  tableTh: {
    padding: '16px 20px',
    textAlign: 'left',
    fontWeight: 600,
    color: '#2c3e50',
    borderBottom: '2px solid #4a7c59',
    backgroundColor: '#f8f9fa'
  },
  tableTd: {
    padding: '16px 20px',
    borderBottom: '1px solid #e0e0e0',
    verticalAlign: 'middle'
  },
  tableTr: {
    transition: 'background-color 0.2s ease'
  },
  fieldName: { fontWeight: 600, color: '#2c3e50', fontSize: 16 },
  cropType: { color: '#27ae60', fontWeight: 500, fontSize: 16 },
  primaryBtn: { 
    background: 'linear-gradient(135deg,#2d5016,#4a7c59)', 
    color: '#fff', 
    border: 'none', 
    padding: '12px 24px', 
    borderRadius: 8, 
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  }
};

export default styles;

