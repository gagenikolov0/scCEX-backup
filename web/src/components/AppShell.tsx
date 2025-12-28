import Header from './Header'
import { Box, Container } from '@mantine/core'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Box>
      <Header />
      <Container fluid px="md" pt={0} pb="lg">
        {children}
      </Container>
    </Box>
  )
}


