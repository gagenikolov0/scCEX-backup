import { memo, useState, useEffect, useCallback } from 'react'
import { Card, TextInput, Button, Tabs, Modal, NumberInput, Slider, Flex, Box, Stack, Group, Text } from '@mantine/core'
import TradeSlider from './TradeSlider'

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
    }, [qty, orderType, limitPrice, leverage, onPlaceOrder])

    const handleClosePosition = useCallback(() => {
        onClosePosition(`${token}_${quote}`, qty)
    }, [token, quote, qty, onClosePosition])

    const handleSliderChange = useCallback((val: number) => {
        setPercent(val)
        if (tradeMode === 'close') {
            const pos = futuresPositions.find(p => p.symbol === `${token}_${quote}`)
            if (pos) {
                if (val === 100) {
                    setQty(pos.quantity.toString())
                } else {
                    setQty(((pos.quantity * val) / 100).toFixed(8).replace(/\.?0+$/, ''))
                }
            }
        }
    }, [tradeMode, futuresPositions, token, quote])

    return (
        <Card padding={0} withBorder radius="md" h={1171} style={{ overflowY: 'auto' }} shadow="xs">
            <Box bg="var(--bg-2)" h={40} px="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', display: 'flex', alignItems: 'center' }}>
                <Text size="sm" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>Futures Trade</Text>
            </Box>
            <Flex direction="column" gap="md" p="md">
                <Tabs value={tradeMode} onChange={(val) => setTradeMode(val as 'open' | 'close')} variant="pills" radius="md" color="blue">
                    <Tabs.List grow>
                        <Tabs.Tab value="open">Open</Tabs.Tab>
                        <Tabs.Tab value="close">Close</Tabs.Tab>
                    </Tabs.List>
                </Tabs>

                {tradeMode === 'open' && (
                    <>
                        <Button
                            variant="default"
                            fullWidth
                            size="sm"
                            justify="space-between"
                            onClick={() => {
                                setTempLeverage(leverage)
                                setOpenedLeverage(true)
                            }}
                            rightSection={<Text size="xs" c="dimmed">Isolated</Text>}
                        >
                            {leverage}x
                        </Button>

                        <Modal
                            opened={openedLeverage}
                            onClose={() => setOpenedLeverage(false)}
                            title="Adjust Leverage"
                            centered
                            size="xs"
                            lockScroll={false}
                        >
                            <Stack gap="md">
                                <NumberInput
                                    label="Leverage"
                                    value={Number(tempLeverage)}
                                    onChange={(val) => setTempLeverage(String(val))}
                                    max={500}
                                    min={1}
                                    size="md"
                                    suffix="x"
                                />

                                <Group gap="xs">
                                    {['10', '20', '50', '100', '500'].map(lv => (
                                        <Button
                                            key={lv}
                                            size="compact-sm"
                                            variant={tempLeverage === lv ? "filled" : "outline"}
                                            color={tempLeverage === lv ? "blue" : "gray"}
                                            onClick={() => setTempLeverage(lv)}
                                        >
                                            {lv}x
                                        </Button>
                                    ))}
                                </Group>

                                <Slider
                                    value={Number(tempLeverage)}
                                    onChange={(val) => setTempLeverage(String(val))}
                                    max={500}
                                    min={1}
                                    step={1}
                                    label={(val) => `${val}x`}
                                    marks={[
                                        { value: 1, label: '1x' },
                                        { value: 250, label: '250x' },
                                        { value: 500, label: '500x' },
                                    ]}
                                />

                                <Group grow mt="md">
                                    <Button variant="light" color="gray" onClick={() => setOpenedLeverage(false)}>
                                        Cancel
                                    </Button>
                                    <Button color="blue" onClick={() => {
                                        setLeverage(tempLeverage)
                                        setOpenedLeverage(false)
                                    }}>
                                        Confirm
                                    </Button>
                                </Group>
                            </Stack>
                        </Modal>
                    </>
                )}

                <Tabs value={orderType} onChange={(v) => setOrderType(v as 'market' | 'limit')} variant="pills" radius="md">
                    <Tabs.List grow>
                        <Tabs.Tab value="market">Market</Tabs.Tab>
                        <Tabs.Tab value="limit">Limit</Tabs.Tab>
                    </Tabs.List>
                </Tabs>

                {orderType === 'limit' && (
                    <TextInput label="Limit Price" placeholder="0.00" value={limitPrice} onChange={(e) => setLimitPrice(e.currentTarget.value)} size="xs" />
                )}

                {tradeMode === 'open' ? (
                    <Text size="xs" c="dimmed">Available: {Number(available).toLocaleString(undefined, { maximumFractionDigits: 4 })} {quote}</Text>
                ) : (
                    <Text size="xs" c="dimmed">
                        Position Available: {
                            (() => {
                                const pos = futuresPositions.find(p => p.symbol === `${token}_${quote}`)
                                return pos ? `${Number(pos.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token}` : `0 ${token}`
                            })()
                        }
                    </Text>
                )}

                <TextInput
                    label={tradeMode === 'open' ? `Quantity (${quote})` : `Quantity (${token})`}
                    placeholder="0.00"
                    value={qty}
                    onChange={(e) => setQty(e.currentTarget.value)}
                    size="xs"
                />

                {tradeMode === 'open' && (
                    <Text size="xs" c="dimmed" mt={-8}>
                        Est. Margin: <Text component="span" fw={600} c="var(--mantine-color-text)">
                            {(Number(qty || 0) / Number(leverage || 1)).toFixed(2)} {quote}
                        </Text>
                    </Text>
                )}

                <TradeSlider
                    value={percent}
                    onChange={handleSliderChange}
                />

                <Flex gap="md">
                    {tradeMode === 'open' ? (
                        <>
                            <Button flex={1} color="var(--green)" loading={loadingOrder === 'buy'} onClick={() => handlePlaceOrder('long')} disabled={!isAuthed}>Buy / Long</Button>
                            <Button flex={1} color="var(--red)" loading={loadingOrder === 'sell'} onClick={() => handlePlaceOrder('short')} disabled={!isAuthed}>Sell / Short</Button>
                        </>
                    ) : (
                        <Button
                            flex={1}
                            color="#fe445c"
                            variant="filled"
                            onClick={handleClosePosition}
                            disabled={!isAuthed || !qty}
                        >
                            Close Position
                        </Button>
                    )}
                </Flex>

                <Button variant="default" onClick={onTransferClick} disabled={!isAuthed}>Transfer</Button>
                <Button
                    variant="filled"
                    color="blue"
                    radius="md"
                    onClick={() => window.location.href = '/deposit'}
                >
                    Deposit
                </Button>
                {!isAuthed && <Text size="xs" c="dimmed">Login to trade and see your balances.</Text>}
            </Flex>
        </Card>
    )
})

FuturesTradeForm.displayName = 'FuturesTradeForm'
