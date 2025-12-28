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
  components: {
    Button: {
      defaultProps: {
        loaderProps: { type: 'dots' },
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
      styles: {
        root: {
          '&:active': {
            transform: 'none !important',
          },
        },
      },
    },
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
