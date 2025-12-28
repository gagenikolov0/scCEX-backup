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
      '#C1C2C5', '#A6A7AB', '#909296', '#5C5F66', '#373A40',
      '#2C2E33', '#25262B', '#020202', '#141517', '#101113',
    ],
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
