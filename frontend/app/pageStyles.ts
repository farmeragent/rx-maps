import type { CSSProperties } from 'react';
import { THEME } from '../constants';

const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#334155';

const styles: Record<string, CSSProperties> = {
  appRoot: {
    minHeight: '100vh',
    background: THEME.BACKGROUND.HERO,
    color: TEXT_PRIMARY,
    display: 'flex',
    flexDirection: 'column'
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '48px 32px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 32
  },
  headerBox: {
    background: THEME.BACKGROUND.SURFACE_ELEVATED,
    borderRadius: 18,
    padding: '36px 28px',
    margin: '0',
    boxShadow: THEME.SHADOW.PANEL,
    textAlign: 'center',
    border: THEME.BORDER.MEDIUM,
    backdropFilter: 'blur(18px)'
  },
  headerTitle: {
    margin: '0 0 10px 0',
    color: TEXT_PRIMARY,
    fontSize: '30px',
    fontWeight: 600,
    letterSpacing: '0.02em'
  },
  headerSub: {
    margin: 0,
    color: TEXT_SECONDARY,
    fontSize: '16px'
  },
  contentCard: {
    background: THEME.BACKGROUND.SURFACE_ELEVATED,
    borderRadius: 20,
    padding: 32,
    boxShadow: THEME.SHADOW.PANEL,
    border: THEME.BORDER.MEDIUM,
    backdropFilter: 'blur(16px)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '15px',
    color: TEXT_PRIMARY
  },
  tableTh: {
    padding: '16px 20px',
    textAlign: 'left',
    fontWeight: 600,
    color: TEXT_PRIMARY,
    borderBottom: THEME.BORDER.MEDIUM,
    backgroundColor: THEME.BACKGROUND.TABLE_HEADER,
    letterSpacing: '0.02em'
  },
  tableTd: {
    padding: '16px 20px',
    borderBottom: THEME.BORDER.TABLE_ROW,
    verticalAlign: 'middle',
    color: TEXT_SECONDARY
  },
  tableTr: {
    transition: 'background-color 0.2s ease',
    backgroundColor: 'transparent'
  },
  fieldName: { fontWeight: 600, color: TEXT_PRIMARY, fontSize: 16 },
  cropType: { color: '#0f5132', fontWeight: 500, fontSize: 16 },
  primaryBtn: {
    background: THEME.ACCENT.PRIMARY_GRADIENT,
    color: THEME.ACCENT.TEXT_DARK,
    border: 'none',
    padding: '10px 20px',
    borderRadius: 999,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: THEME.SHADOW.LIFT
  }
};

export default styles;

