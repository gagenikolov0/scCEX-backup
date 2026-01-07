import { Box, rem, useMantineColorScheme, Stack, Text } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'

export const VerticalStep = ({ step, title, children, complete, active, isLast = false }: any) => {
    const { colorScheme } = useMantineColorScheme()
    const isDark = colorScheme === 'dark'

    return (
        <Box style={{ position: 'relative', paddingLeft: rem(44), paddingBottom: isLast ? 0 : rem(32) }}>
            {!isLast && (
                <Box
                    style={{
                        position: 'absolute',
                        left: rem(11),
                        top: rem(28),
                        bottom: 0,
                        width: 2,
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        transition: 'background 0.3s ease'
                    }}
                />
            )}
            <Box
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: rem(24),
                    height: rem(24),
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: rem(12),
                    fontWeight: 700,
                    background: complete ? 'var(--mantine-color-blue-filled)' : active ? 'var(--mantine-color-blue-light)' : 'var(--mantine-color-default-hover)',
                    color: complete ? 'white' : active ? 'var(--mantine-color-blue-filled)' : 'var(--mantine-color-dimmed)',
                    border: active ? '1px solid var(--mantine-color-blue-filled)' : '1px solid transparent',
                    zIndex: 2,
                    transition: 'all 0.3s ease'
                }}
            >
                {complete ? <IconCheck size={14} /> : step}
            </Box>
            <Stack gap="md">
                <Text fw={700} size="lg" style={{ lineHeight: 1 }}>{title}</Text>
                <Box>{children}</Box>
            </Stack>
        </Box>
    )
}
