
import { Box, Paper, Text, Group, Avatar, Badge, Stack, ThemeIcon, Transition } from '@mantine/core'
import { IconCircleCheckFilled, IconShare, IconShieldCheck, IconArrowRight } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import classes from './SocialTradingVisual.module.css'

export function SocialTradingVisual() {
    const [step, setStep] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => {
            setStep((s) => (s + 1) % 4)
        }, 3000)
        return () => clearInterval(timer)
    }, [])

    return (
        <Box className={classes.root}>
            {/* Background Glow */}
            <Box className={classes.glow} />

            {/* Verification Path Line */}
            <Box className={classes.path} />

            {/* Step 1: The PnL Card Share */}
            <Transition mounted={step >= 0} transition="slide-right" duration={500}>
                {(styles) => (
                    <Paper
                        style={styles}
                        className={`${classes.card} ${classes.pnlCard} ${step === 0 ? classes.active : ''}`}
                        radius="lg" p="md" withBorder
                    >
                        <Group justify="space-between" mb="xs">
                            <Text size="xs" fw={700} c="dimmed">SOL/USDT Perpetual</Text>
                            <Badge color="green" variant="light" size="sm">20x</Badge>
                        </Group>
                        <Text size="32px" fw={950} c="green" style={{ letterSpacing: '-1px' }}>+142.50%</Text>
                        <Group justify="space-between" mt="sm">
                            <Text size="xs" c="dimmed">Entry: $102.40</Text>
                            <ThemeIcon size="sm" radius="xl" color="blue" variant="light">
                                <IconShare size={12} />
                            </ThemeIcon>
                        </Group>
                    </Paper>
                )}
            </Transition>

            {/* Step 2: The Verification System */}
            <Transition mounted={step >= 1} transition="pop" duration={500}>
                {(styles) => (
                    <Box style={styles} className={`${classes.verifier} ${step === 1 ? classes.active : ''}`}>
                        <Stack align="center" gap={4}>
                            <Box className={classes.pulseRing} />
                            <ThemeIcon size={64} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                                <IconShieldCheck size={32} />
                            </ThemeIcon>
                            <Text fw={800} size="sm" className="animate-text-shimmer">VERIFYING</Text>
                        </Stack>
                    </Box>
                )}
            </Transition>

            {/* Step 3: Verified Status */}
            <Transition mounted={step >= 2} transition="slide-left" duration={500}>
                {(styles) => (
                    <Paper
                        style={styles}
                        className={`${classes.card} ${classes.verifiedCard} ${step === 2 ? classes.active : ''}`}
                        radius="lg" p="md" withBorder
                    >
                        <Group gap="sm" mb="xs">
                            <Avatar size="md" src={null} radius="xl" color="blue">JD</Avatar>
                            <Stack gap={0}>
                                <Group gap={4}>
                                    <Text fw={700} size="sm">John_Trader</Text>
                                    <IconCircleCheckFilled size={14} color="var(--mantine-color-blue-6)" />
                                </Group>
                                <Text size="xs" c="dimmed">Diamond Tier</Text>
                            </Stack>
                        </Group>
                        <Box h={1} bg="rgba(255,255,255,0.05)" my="sm" />
                        <Group justify="space-between">
                            <Stack gap={0}>
                                <Text size="xs" c="dimmed">30D PnL</Text>
                                <Text fw={700} c="green">+$12,450</Text>
                            </Stack>
                            <ThemeIcon variant="light" color="blue" radius="md">
                                <IconArrowRight size={16} />
                            </ThemeIcon>
                        </Group>
                    </Paper>
                )}
            </Transition>

            {/* Labels */}
            <Box className={classes.labels}>
                <Text
                    className={`${classes.label} ${step === 0 ? classes.visible : ''}`}
                    style={{ top: '20px', left: '0' }}
                >
                    "I made 140%!"
                </Text>
                <Text
                    className={`${classes.label} ${step === 1 ? classes.visible : ''}`}
                    style={{ top: '-40px', left: '50%', transform: 'translateX(-50%)' }}
                >
                    Checking Platform History...
                </Text>
                <Text
                    className={`${classes.label} ${step === 2 || step === 3 ? classes.visible : ''}`}
                    style={{ bottom: '20px', right: '0' }}
                >
                    PROOF OF PERFORMANCE
                </Text>
            </Box>
        </Box>
    )
}
