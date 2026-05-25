import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

export const theme = extendTheme({
  config,
  fonts: {
    heading: `'Inter', -apple-system, sans-serif`,
    body: `'Inter', -apple-system, sans-serif`,
  },
  colors: {
    brand: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
    },
  },
  styles: {
    global: {
      'html, body': {
        bg: 'transparent',
        color: 'white',
        minH: '100vh',
      },
      '::-webkit-scrollbar': { width: '4px' },
      '::-webkit-scrollbar-track': { background: 'rgba(255,255,255,0.03)' },
      '::-webkit-scrollbar-thumb': {
        background: 'rgba(165,180,252,0.25)',
        borderRadius: '4px',
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: 'rgba(165,180,252,0.4)',
      },
    },
  },
  components: {
    Button: {
      baseStyle: { borderRadius: '10px', fontWeight: 600 },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'full',
        fontWeight: 600,
        letterSpacing: '0.02em',
      },
    },
    Input: {
      variants: {
        glass: {
          field: {
            bg: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            color: 'white',
            _placeholder: { color: 'whiteAlpha.400' },
            _focus: {
              borderColor: 'brand.400',
              boxShadow: '0 0 0 2px rgba(99,102,241,0.25)',
              bg: 'rgba(255,255,255,0.1)',
            },
          },
        },
      },
    },
    Textarea: {
      variants: {
        glass: {
          bg: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px',
          color: 'white',
          _placeholder: { color: 'whiteAlpha.400' },
          _focus: {
            borderColor: 'brand.400',
            boxShadow: '0 0 0 2px rgba(99,102,241,0.25)',
            bg: 'rgba(255,255,255,0.1)',
          },
        },
      },
    },
    Select: {
      variants: {
        glass: {
          field: {
            bg: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            color: 'white',
            _focus: {
              borderColor: 'brand.400',
              boxShadow: '0 0 0 2px rgba(99,102,241,0.25)',
            },
          },
        },
      },
    },
  },
});
