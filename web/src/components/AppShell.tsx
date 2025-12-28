import Header from './Header'
import { Box, Container } from '@mantine/core'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Box>
      <Header />
      <Container size="xl" py="lg">
        {children}
      </Container>
    </Box>
  )
}


