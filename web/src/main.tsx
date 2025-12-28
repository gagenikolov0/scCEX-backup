import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

const theme = createTheme({
  primaryColor: 'gray',
  fontSizes: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
  },
  colors: {
    // Custom colors to match the exchange UI
    brand: [
      '#f8f9fa', '#f1f3f5', '#e9ecef', '#dee2e6', '#adb5bd',
      '#868e96', '#495057', '#343a40', '#212529', '#1a1b1e'
    ],
    green: [
      '#e6fcf5', '#c3fae8', '#96f2d7', '#63e6be', '#38d9a9',
      '#20c997', '#12b886', '#0ca678', '#099268', '#087f5b'
    ],
    red: [
      '#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787',
      '#ff6b6b', '#fa5252', '#f03e3e', '#e03131', '#c92a2a'
    ],
  },
  components: {
    Button: {
      defaultProps: {
        loaderProps: { type: 'dots' },
        radius: 'md',
      },
      styles: {
        root: {
          '&:active': {
            transform: 'none !important',
          },
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          '&:active': {
            transform: 'none !important',
          },
        },
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
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </StrictMode>,
)
