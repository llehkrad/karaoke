// Tailwind theme extension — MelodyHub design system
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: '#FBFCFE',
        surface: '#FFFFFF',
        field: '#EFEFF9',
        rail: '#181C27',
        stage: '#040A18',
        player: '#1D2031',
        panel: '#262E45',
        'nav-active': '#2F2D45',
        hairline: '#EEF0F5',
        accent: { DEFAULT: '#6B66DE', hover: '#5A55CE', soft: '#F4F1FD', ondark: '#8E86C9' },
        ink: { DEFAULT: '#181C27', secondary: '#5A6070', body: '#6E7482', muted: '#8A90A0' },
        tile: {
          violet: '#9F8CE4', 'violet-bg': '#F4F1FD',
          sky: '#89B8EB', 'sky-bg': '#EAF3FD',
          blush: '#F9B8DD', 'blush-bg': '#FDEEF7',
          mint: '#7CD4AC', 'mint-bg': '#EAF9F2',
        },
      },
      borderColor: { DEFAULT: '#E4E7EF', strong: '#DDE0EA' },
      borderRadius: { sm: '8px', md: '12px', lg: '16px', pill: '999px' },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        script: ['Caveat', 'cursive'],
      },
      fontSize: {
        eyebrow: ['12px', { lineHeight: '1.2', letterSpacing: '0.18em', fontWeight: '500' }],
        meta: ['13px', { lineHeight: '1.4' }],
        body: ['14px', { lineHeight: '1.5' }],
        'card-title': ['16px', { lineHeight: '1.3', fontWeight: '500' }],
        'section-title': ['24px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        display: ['54px', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
      },
      boxShadow: { hover: '0 4px 16px rgba(24, 28, 39, 0.06)' },
      spacing: { gutter: '16px', card: '24px', section: '40px' },
      width: { rail: '240px', context: '380px' },
      height: { player: '96px' },
    },
  },
};
