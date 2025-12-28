import { Box, Title, Text, Stack } from '@mantine/core'

export default function Home() {
  return (
    <Box p="xl" mih="calc(100vh - 100px)">
      <Stack gap="md">
        <Title order={1} size="h2" fw={600}>Home</Title>
        <Text size="sm" c="dimmed">Go to the Deposit page to view your deposit addresses and QR.</Text>
      </Stack>
    </Box>
  )
}


