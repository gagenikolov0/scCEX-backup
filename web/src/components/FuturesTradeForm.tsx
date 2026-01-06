import { memo, useState, useEffect, useCallback } from 'react'
import { Card, TextInput, Button, SegmentedControl, Modal, NumberInput, Slider, Flex, Box, Stack, Group, Text, Badge, SimpleGrid, rem } from '@mantine/core'
import TradeSlider from './TradeSlider'
import { IconArrowsSort, IconWallet } from '@tabler/icons-react'

interface FuturesTradeFormProps {
    token: string
    quote: string
    isAuthed: boolean
    available: string
    futuresPositions: any[]
    onPlaceOrder: (side: 'long' | 'short', qty: string, orderType: 'market' | 'limit', limitPrice: string, leverage: string) => void
    onClosePosition: (symbol: string, qty: string) => void
    onTransferClick: () => void
    loadingOrder: null | 'buy' | 'sell'
}

export const FuturesTradeForm = memo(({
    token,
    quote,
    isAuthed,
    available,
    futuresPositions,
    onPlaceOrder,
    onClosePosition,
    onTransferClick,
    loadingOrder
}: FuturesTradeFormProps) => {
    const [qty, setQty] = useState('')
    const [leverage, setLeverage] = useState('10')
    const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
    const [limitPrice, setLimitPrice] = useState('')
    const [tradeMode, setTradeMode] = useState<'open' | 'close'>('open')
    const [percent, setPercent] = useState(0)
    const [openedLeverage, setOpenedLeverage] = useState(false)
    const [tempLeverage, setTempLeverage] = useState('10')

    const activePosition = futuresPositions.find(p => p.symbol === `${token}_${quote}`)

    useEffect(() => {
        if (tradeMode === 'open' && percent > 0) {
            const max = parseFloat(available)
            const lev = Number(leverage || 1)
            const newQty = ((max * lev * percent) / 100).toFixed(8).replace(/\.?0+$/, '')
            if (newQty !== qty) setQty(newQty)
        }
    }, [percent, leverage, tradeMode, available])

    const handlePlaceOrder = useCallback((side: 'long' | 'short') => {
        onPlaceOrder(side, qty, orderType, limitPrice, leverage)
        setQty('')
        setPercent(0)
    }, [qty, orderType, limitPrice, leverage, onPlaceOrder])

    const handleClosePosition = useCallback(() => {
        onClosePosition(`${token}_${quote}`, qty)
        setQty('')
        setPercent(0)
    }, [token, quote, qty, onClosePosition])

    const handleSliderChange = useCallback((val: number) => {
        setPercent(val)
        if (tradeMode === 'close' && activePosition) {
            if (val === 100) {
                setQty(activePosition.quantity.toString())
            } else {
                setQty(((activePosition.quantity * val) / 100).toFixed(8).replace(/\.?0+$/, ''))
            }
        }
    }, [tradeMode, activePosition])

    return (
        <Card padding={0} withBorder radius="md" h={1171} style={{ overflowY: 'auto' }} shadow="xs">
            <Box bg="var(--bg-2)" h={39.59} px="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text size="sm" fw={700} tt="uppercase" style={{ letterSpacing: '0.05em' }} px="xs">Trade {token}</Text>
                <Badge variant="light" color="blue" size="sm" radius="sm" mr="xs">isolated</Badge>
            </Box>

            <Flex direction="column" gap="xs" p="md">
                {/* ... Toggle ... */}
                <SegmentedControl
                    value={tradeMode}
                    onChange={(val) => setTradeMode(val as 'open' | 'close')}
                    fullWidth
                    size="xs"
                    radius="md"
                    data={[
                        { label: 'Open', value: 'open' },
                        { label: 'Close', value: 'close' }
                    ]}
                />

                {tradeMode === 'open' && (
                    <>
                        <Stack gap={6}>
                            <Button
                                variant="light"
                                color="gray"
                                fullWidth
                                size="xs"
                                radius="md"
                                onClick={() => {
                                    setTempLeverage(leverage)
                                    setOpenedLeverage(true)
                                }}
                                rightSection={<IconArrowsSort size={10} />}
                                style={{ border: '1px solid var(--mantine-color-default-border)' }}
                            >
                                {leverage}x Leverage
                            </Button>
                            <SegmentedControl
                                value={orderType}
                                onChange={(val) => setOrderType(val as 'market' | 'limit')}
                                size="xs"
                                radius="md"
                                data={[
                                    { label: 'Market', value: 'market' },
                                    { label: 'Limit', value: 'limit' }
                                ]}
                            />
                        </Stack>

                        <Modal
                            opened={openedLeverage}
                            onClose={() => setOpenedLeverage(false)}
                            title={<Text fw={700} size="sm">Adjust Leverage</Text>}
                            centered
                            size="xs"
                            padding="sm"
                            radius="md"
                            overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
                            transitionProps={{ transition: 'pop', duration: 200 }}
                            lockScroll={false}
                        >
                            <Stack gap="sm">
                                <Box bg="var(--bg-2)" p="xs" style={{ borderRadius: 'var(--mantine-radius-md)', textAlign: 'center', border: '1px solid var(--border-1)' }}>
                                    <Text style={{ fontSize: rem(10) }} c="dimmed" tt="uppercase" fw={700} mb={2}>Current Leverage</Text>
                                    <Text size="xl" fw={900} c={Number(tempLeverage) > 50 ? 'red' : Number(tempLeverage) > 20 ? 'orange' : 'green'} style={{ lineHeight: 1 }}>{tempLeverage}x</Text>
                                </Box>
                                <Stack gap={4}>
                                    <Group justify="space-between">
                                        <Text size="xs" fw={500}>Manual</Text>
                                        <NumberInput
                                            value={Number(tempLeverage)}
                                            onChange={(val) => setTempLeverage(String(val))}
                                            max={1000}
                                            min={1}
                                            size="xs"
                                            w={60}
                                            styles={{ input: { textAlign: 'center', padding: 0 } }}
                                        />
                                    </Group>
                                    <Slider
                                        value={Number(tempLeverage)}
                                        onChange={(val) => setTempLeverage(String(val))}
                                        max={1000}
                                        min={1}
                                        label={null}
                                        size="sm"
                                    />
                                </Stack>
                                <SimpleGrid cols={5} spacing={4}>
                                    {[10, 20, 50, 100, 125, 500, 1000].map((preset) => (
                                        <Button
                                            key={preset}
                                            variant={Number(tempLeverage) === preset ? 'filled' : 'light'}
                                            color="gray"
                                            size="xs"
                                            p={0}
                                            onClick={() => setTempLeverage(String(preset))}
                                        >
                                            {preset}x
                                        </Button>
                                    ))}
                                </SimpleGrid>
                                <Group grow mt="xs">
                                    <Button variant="subtle" color="gray" size="xs" onClick={() => setOpenedLeverage(false)}>Cancel</Button>
                                    <Button size="xs" onClick={() => { setLeverage(tempLeverage); setOpenedLeverage(false); }}>Confirm</Button>
                                </Group>
                            </Stack>
                        </Modal>
                    </>
                )}

                {/* Available Balance */}
                <Group justify="space-between" mb={-4}>
                    <Group gap={4}>
                        <IconWallet size={10} color="var(--mantine-color-dimmed)" />
                        <Text c="dimmed" style={{ fontSize: rem(11) }}>
                            {tradeMode === 'open' ? 'Available:' : 'Position:'}
                        </Text>
                        <Text fw={700} style={{ cursor: 'pointer', fontSize: rem(11) }} onClick={() => {
                            if (tradeMode === 'open') {
                                setQty(available)
                            } else if (activePosition) {
                                setQty(activePosition.quantity.toString())
                            }
                        }}>
                            {tradeMode === 'open' ? Number(available).toFixed(2) : (activePosition ? Number(activePosition.quantity).toFixed(4) : '0.00')}
                        </Text>
                    </Group>
                    <Text c="blue" fw={700} style={{ cursor: 'pointer', fontSize: rem(11) }} onClick={onTransferClick}>Transfer</Text>
                </Group>

                {/* Inputs */}
                <Stack gap={6} mt={tradeMode === 'close' ? 4 : 0}>
                    {orderType === 'limit' && tradeMode === 'open' && (
                        <TextInput
                            placeholder="Price"
                            value={limitPrice}
                            onChange={(e) => setLimitPrice(e.currentTarget.value)}
                            rightSection={<Text size="xs" c="dimmed" pr="xs">USDT</Text>}
                            rightSectionWidth={50}
                            radius="md"
                            size="xs"
                        />
                    )}

                    <TextInput
                        placeholder={tradeMode === 'open' ? "Amount" : "Close Amount"}
                        value={qty}
                        onChange={(e) => setQty(e.currentTarget.value)}
                        rightSection={<Text size="xs" c="dimmed" pr="xs">{tradeMode === 'open' ? quote : token}</Text>}
                        rightSectionWidth={50}
                        radius="md"
                        size="xs"
                    />
                </Stack>

                <TradeSlider value={percent} onChange={handleSliderChange} />

                {tradeMode === 'open' ? (
                    <Flex gap="xs" mt={4}>
                        <Button
                            flex={1}
                            color="var(--green)"
                            size="sm"
                            radius="md"
                            loading={loadingOrder === 'buy'}
                            onClick={() => handlePlaceOrder('long')}
                            disabled={!isAuthed}
                        >
                            Open Long
                        </Button>
                        <Button
                            flex={1}
                            color="var(--red)"
                            size="sm"
                            radius="md"
                            loading={loadingOrder === 'sell'}
                            onClick={() => handlePlaceOrder('short')}
                            disabled={!isAuthed}
                        >
                            Open Short
                        </Button>
                    </Flex>
                ) : (
                    <Button
                        fullWidth
                        color="gray"
                        variant="light"
                        size="sm"
                        radius="md"
                        mt={4}
                        onClick={handleClosePosition}
                        disabled={!isAuthed || !qty}
                    >
                        Close Position
                    </Button>
                )}

                {!isAuthed && (
                    <Button variant="light" size="sm" fullWidth radius="md" component="a" href="/login">
                        Log in or Sign up
                    </Button>
                )}
            </Flex>
        </Card >
    )
})

FuturesTradeForm.displayName = 'FuturesTradeForm'
