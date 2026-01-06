import React, { useState, useMemo } from 'react';
import { Box, Text, Group, Stack, Paper, SimpleGrid, ActionIcon, Center, ThemeIcon, Badge } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

interface PNLDay {
    date: string | Date;
    pnl: number;
    roi: number;
}

interface PNLCalendarProps {
    data: PNLDay[];
    livePNL?: number;
    liveROI?: number;
}

const formatRoi = (roi: number) => {
    return `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%`;
};

export const PNLCalendar: React.FC<PNLCalendarProps> = ({ data, livePNL, liveROI }) => {
    const [viewDate, setViewDate] = useState(new Date());

    const { monthDays, monthLabel } = useMemo(() => {
        const year = viewDate.getUTCFullYear();
        const month = viewDate.getUTCMonth();

        const firstDay = new Date(Date.UTC(year, month, 1));
        const lastDay = new Date(Date.UTC(year, month + 1, 0));

        const days = [];
        // Add padding for start of month
        const startPadding = firstDay.getUTCDay(); // 0 is Sunday, 1 is Monday...
        const adjustedPadding = startPadding === 0 ? 6 : startPadding - 1; // Map to Mon-Sun

        for (let i = 0; i < adjustedPadding; i++) {
            days.push(null);
        }

        for (let d = 1; d <= lastDay.getUTCDate(); d++) {
            const date = new Date(Date.UTC(year, month, d));
            const dateStr = date.toISOString().split('T')[0];
            const found = data.find(item => {
                const itemDate = new Date(item.date).toISOString().split('T')[0];
                return itemDate === dateStr;
            });
            days.push({
                day: d,
                date,
                pnl: found ? found.pnl : 0,
                roi: found ? found.roi : 0,
                hasData: !!found
            });
        }

        return {
            monthDays: days,
            monthLabel: viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
        };
    }, [viewDate, data]);

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setUTCMonth(newDate.getUTCMonth() + delta);
        setViewDate(newDate);
    };

    const getColor = (pnl: number, hasData: boolean) => {
        if (!hasData) return 'var(--mantine-color-default-hover)';
        if (pnl > 0.01) return 'rgba(47, 158, 68, 0.15)';
        if (pnl < -0.01) return 'rgba(201, 42, 42, 0.15)';
        return 'var(--mantine-color-default-hover)';
    };

    const getBorderColor = (pnl: number, hasData: boolean) => {
        if (!hasData) return 'var(--mantine-color-default-border)';
        if (pnl > 0.01) return '#2f9e44';
        if (pnl < -0.01) return '#c92a2a';
        return 'var(--mantine-color-default-border)';
    };

    const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    return (
        <Paper p="xl" radius="lg" withBorder bg="var(--mantine-color-body)" shadow="sm" maw={850} mx="auto">
            <Stack gap="lg">
                <Group justify="space-between" align="center">
                    <Stack gap={0}>
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>Performance</Text>
                        <Text size="lg" fw={900}>{monthLabel}</Text>
                    </Stack>
                    <Group gap="xs">
                        <ActionIcon variant="light" size="md" onClick={() => changeMonth(-1)}>
                            <IconChevronLeft size={18} />
                        </ActionIcon>
                        <ActionIcon variant="light" size="sm" onClick={() => setViewDate(new Date())} px="md" h={32} style={{ width: 'auto' }}>
                            <Text size="sm" fw={700}>Today</Text>
                        </ActionIcon>
                        <ActionIcon variant="light" size="md" onClick={() => changeMonth(1)}>
                            <IconChevronRight size={18} />
                        </ActionIcon>
                    </Group>
                </Group>

                <Box>
                    <SimpleGrid cols={7} spacing="md" mb="md">
                        {weekdays.map(w => (
                            <Center key={w}>
                                <Text size="xs" fw={800} c="dimmed">{w}</Text>
                            </Center>
                        ))}
                    </SimpleGrid>

                    <SimpleGrid cols={7} spacing="md">
                        {monthDays.map((day, i) => {
                            if (!day) return <Box key={`pad-${i}`} />;

                            const isToday = day.date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                            const currentPnl = (isToday && livePNL !== undefined) ? livePNL : day.pnl;
                            const currentRoi = (isToday && liveROI !== undefined) ? liveROI : day.roi;
                            const hasPerformance = (day.hasData || (isToday && (Math.abs(currentPnl) > 0.001 || Math.abs(currentRoi) > 0.001)));

                            return (
                                <Paper
                                    key={i}
                                    p="sm"
                                    radius="md"
                                    style={{
                                        aspectRatio: '1/1',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        backgroundColor: getColor(currentPnl, hasPerformance),
                                        border: `1px solid ${getBorderColor(currentPnl, hasPerformance)}`,
                                        position: 'relative',
                                        minHeight: 84, // Increased from 68
                                        boxShadow: (isToday && hasPerformance) ? '0 0 10px var(--mantine-primary-color-light)' : 'none'
                                    }}
                                >
                                    <Group justify="space-between" align="flex-start">
                                        <Text size="sm" fw={800} c={hasPerformance ? undefined : 'dimmed'}>{day.day}</Text>
                                        <Group gap={4}>
                                            {isToday && <Badge size="xs" variant="filled" color="blue" radius="xs" h={14} py={0} px={4} style={{ fontSize: 8 }}>LIVE</Badge>}
                                            {hasPerformance && (
                                                <ThemeIcon
                                                    size={14}
                                                    variant="transparent"
                                                    color={currentPnl >= 0 ? 'green' : 'red'}
                                                >
                                                    {currentPnl >= 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                                                </ThemeIcon>
                                            )}
                                        </Group>
                                    </Group>

                                    {hasPerformance ? (
                                        <Stack gap={0} align="center">
                                            <Text size="14px" fw={950} color={currentPnl >= 0 ? 'green' : 'red'} lh={1.2}>
                                                {currentPnl > 0 ? '+' : ''}{currentPnl.toFixed(1)}
                                            </Text>
                                            <Text size="10px" fw={700} color={currentRoi >= 0 ? 'green' : 'red'} opacity={0.8}>
                                                {formatRoi(currentRoi)}
                                            </Text>
                                        </Stack>
                                    ) : (
                                        <Center h="100%">
                                            <Text size="10px" c="dimmed" fs="italic" style={{ opacity: 0.3 }}>-</Text>
                                        </Center>
                                    )}
                                </Paper>
                            );
                        })}
                    </SimpleGrid>
                </Box>

                <Group gap="md" justify="center" mt="sm">
                    <Badge variant="dot" color="green" size="sm">Profit</Badge>
                    <Badge variant="dot" color="red" size="sm">Loss</Badge>
                </Group>
            </Stack>
        </Paper>
    );
};
