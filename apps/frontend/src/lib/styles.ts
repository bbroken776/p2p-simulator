export const glassCard = {
  bg: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '16px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.1)',
};

export const glassCardHover = {
  ...glassCard,
  _hover: {
    bg: 'rgba(255,255,255,0.09)',
    boxShadow:
      '0 12px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
    transform: 'translateY(-1px)',
  },
  transition: 'all 0.2s',
};

export const glassNav = {
  bg: 'rgba(15,23,42,0.6)',
  backdropFilter: 'blur(24px)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 1px 32px rgba(0,0,0,0.3)',
};
