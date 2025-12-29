import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import App from './App.tsx'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

const theme = createTheme({
  primaryColor: 'gray',
  black: '#020202',
  white: '#ffffff',
  fontSizes: {
    xxs: 'var(--fz-xxs)',
    xs: 'var(--fz-xs)',
    sm: 'var(--fz-sm)',
    md: 'var(--fz-md)',
    lg: 'var(--fz-lg)',
    xl: 'var(--fz-xl)',
  },
  spacing: {
    xs: '8px',
    sm: '12px',
    md: '13px',
    lg: '24px',
    xl: '48px',
  },

  colors: {
    // Custom colors to match the exchange UI

    dark: [
      '#ffffff', // 0: lightest (fg-1)
      '#a6a7ab', // 1: lighter (fg-2)
      '#5c5f66', // 2: light
      '#373a40', // 3: less light (border-1)
      '#25262b', // 4: bg-5
      '#1a1b1e', // 5: bg-4
      '#141517', // 6: bg-3
      '#0a0a0a', // 7: bg-2
      '#050505', // 8: near black
      '#000000', // 9: darkest (bg-1)
    ]
  },
  components: {
    Table: {
      styles: {
        tr: {
          '--table-hover-color': 'light-dark(var(--mantine-color-gray-1), rgba(255, 255, 255, 0.04))',
        }
      }
    },
    Button: {
      defaultProps: {
        loaderProps: { type: 'dots' },
        radius: 'md',
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
    },
    Card: {
      defaultProps: {
        padding: 'md',
        radius: 'md',
        withBorder: true,
      },
    },
    TextInput: {
      defaultProps: {
        size: 'xs',
        radius: 'md',
      },
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={theme}>
    <Notifications position="top-right" />
    <App />
  </MantineProvider>,
)
