import { Modal, Box, Text, Group, Stack, Badge, Button, Divider, Paper, Loader, Avatar } from '@mantine/core'
import { IconDownload, IconShare, IconUser } from '@tabler/icons-react'
import { useRef, useCallback, useState, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { QRCodeSVG } from 'qrcode.react'
import { formatDate, cleanSymbol } from '../lib/utils'
import { useAccount } from '../contexts/AccountContext'

interface SharePNLModalProps {
    opened: boolean
    onClose: () => void
    data: {
        symbol: string
        side: 'long' | 'short'
        leverage: number
        pnl: number
        roi: number
        entryPrice: number
        markPrice?: number
        exitPrice?: number
        liquidationPrice?: number
        isHistory?: boolean
    } | null
}

export default function SharePNLModal({ opened, onClose, data }: SharePNLModalProps) {
    const { email, username, referralCode, profilePicture } = useAccount()
    const cardRef = useRef<HTMLDivElement>(null)
    const [generatedImage, setGeneratedImage] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (opened && data) {
            setLoading(true)
            setGeneratedImage(null)

            // Delay slightly to ensure fonts and styles are applied before capture
            const timer = setTimeout(() => {
                if (cardRef.current) {
                    toPng(cardRef.current, {
                        cacheBust: true,
                        pixelRatio: 4,
                        quality: 1,
                        backgroundColor: 'transparent'
                    })
                        .then((dataUrl) => {
                            setGeneratedImage(dataUrl)
                            setLoading(false)
                        })
                        .catch((err) => {
                            console.error('Capture failed', err)
                            setLoading(false)
                        })
                }
            }, 800)

            return () => clearTimeout(timer)
        }
    }, [opened, data])

    const handleDownload = useCallback(() => {
        if (!generatedImage) return
        const link = document.createElement('a')
        link.download = `pnl-${data?.symbol || 'trade'}.png`
        link.href = generatedImage
        link.click()
    }, [generatedImage, data])

    if (!data) return null

    const isProfit = data.pnl >= 0

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Share your Performance"
            centered
            size="lg"
            radius="lg"
            overlayProps={{ blur: 3, opacity: 0.55 }}
            styles={{ title: { fontWeight: 700 } }}
            lockScroll={false} // Prevents "CPL" (CLS) layout shifts by not hiding body scrollbar
        >
            <Stack gap="xl">
                {/* Source Card (Hidden from user, used for generation) */}
                {/* This prevents user from editing text via DevTools because what they see is a flat image */}
                <Box style={{ position: 'absolute', left: '-9999px', top: 0, width: 520 }}>
                    <Paper
                        ref={cardRef}
                        p={32}
                        radius="xl"
                        style={{
                            background: 'linear-gradient(135deg, #000000 0%, #141517 100%)',
                            border: '1px solid #373a40',
                            position: 'relative',
                            overflow: 'hidden',
                            minHeight: 340,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            webkitFontSmoothing: 'antialiased',
                            mozOsxFontSmoothing: 'grayscale',
                            color: '#ffffff'
                        }}
                    >
                        {/* Background decoration */}
                        <Box style={{
                            position: 'absolute',
                            top: -50,
                            right: -50,
                            width: 300,
                            height: 300,
                            background: isProfit ? 'radial-gradient(circle, rgba(0,255,163,0.1) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(255,68,92,0.1) 0%, transparent 70%)',
                            zIndex: 0
                        }} />

                        {/* Top Bar */}
                        <Group justify="space-between" align="center" style={{ zIndex: 1 }}>
                            <Group gap={12} align="center">
                                <Avatar
                                    src={profilePicture || undefined}
                                    size={44}
                                    radius="xl"
                                    style={{
                                        border: '2px solid #339af0',
                                        boxShadow: '0 0 12px rgba(51, 154, 240, 0.4)'
                                    }}
                                >
                                    <IconUser size={24} color="#339af0" />
                                </Avatar>
                                <Stack gap={0} justify="center">
                                    <Text size="md" color="#ffffff" fw={800} style={{ lineHeight: 1 }}>
                                        {username || (email ? email.split('@')[0] : 'Institutional Trader')}
                                    </Text>
                                </Stack>
                            </Group>
                            <Group gap={12} align="center">
                                <Stack gap={0} align="flex-end" justify="center">
                                    <Text fw={950} size="xl" style={{ letterSpacing: '-0.05em', color: '#339af0', lineHeight: 1, textShadow: '0 0 10px rgba(51, 154, 240, 0.3)' }}>VIRCEX</Text>
                                </Stack>
                                <Box style={{
                                    background: 'rgba(51, 154, 240, 0.1)',
                                    padding: 6,
                                    borderRadius: 10,
                                    border: '1px solid rgba(51, 154, 240, 0.2)',
                                    boxShadow: 'inset 0 0 8px rgba(51, 154, 240, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative'
                                }}>
                                    <Box style={{
                                        position: 'absolute',
                                        inset: 2,
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: 8
                                    }} />
                                    <img src="/icon.png" alt="Logo" style={{ width: 24, height: 24, position: 'relative', zIndex: 1 }} />
                                </Box>
                            </Group>
                        </Group>

                        {/* Middle Section: PNL */}
                        <Stack gap={0} style={{ zIndex: 1 }} my={16}>
                            <Group gap={8} align="center">
                                <Text size="sm" fw={800} tt="uppercase" style={{ letterSpacing: '0.1em', color: '#a6a7ab' }}>
                                    {cleanSymbol(data.symbol)}
                                </Text>
                                <Badge color={data.side === 'long' ? '#0BBA74' : '#ff4761'} variant="filled" size="sm" radius="sm">
                                    {data.leverage}x {data.side.toUpperCase()}
                                </Badge>
                            </Group>

                            <Stack gap={0} mt={8}>
                                <Text
                                    size="4rem"
                                    fw={900}
                                    lh={1.1}
                                    style={{
                                        color: isProfit ? 'var(--green)' : 'var(--red)',
                                        textShadow: isProfit ? '0 0 16px rgba(0,255,163,0.3)' : '0 0 16px rgba(255,68,92,0.3)'
                                    }}
                                >
                                    {isProfit ? '+' : ''}{data.roi.toFixed(2)}%
                                </Text>
                                <Text fw={700} size="xl" c={isProfit ? 'var(--green)' : 'var(--red)'} opacity={0.8}>
                                    {isProfit ? '+' : ''}{data.pnl.toFixed(2)} USDT
                                </Text>
                            </Stack>
                        </Stack>

                        {/* Bottom Section: Details */}
                        <Box style={{ zIndex: 1 }}>
                            <Divider mb="lg" opacity={0.15} color="#373a40" />
                            <Group justify="space-between" align="flex-end" wrap="nowrap">
                                <Stack gap={12}>
                                    <Stack gap={2}>
                                        <Text size="xxs" color="#a6a7ab" fw={700} tt="uppercase" style={{ whiteSpace: 'nowrap' }}>Entry Price</Text>
                                        <Text size="sm" fw={700} color="#ffffff">{data.entryPrice.toFixed(2)}</Text>
                                    </Stack>
                                    <Stack gap={2}>
                                        <Text size="xxs" color="#a6a7ab" fw={700} tt="uppercase" style={{ whiteSpace: 'nowrap' }}>{data.isHistory ? 'Exit Price' : 'Mark Price'}</Text>
                                        <Text size="sm" fw={700} color="#ffffff">{(data.isHistory ? data.exitPrice : data.markPrice)?.toFixed(2) || '-'}</Text>
                                    </Stack>
                                    <Stack gap={2}>
                                        <Text size="xxs" color="#a6a7ab" fw={700} tt="uppercase" style={{ whiteSpace: 'nowrap' }}>Time</Text>
                                        <Text size="sm" fw={700} style={{ whiteSpace: 'nowrap', color: '#ffffff' }}>{formatDate(new Date())}</Text>
                                    </Stack>
                                </Stack>

                                <Group gap="xs" align="center" style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: '6px 6px 6px 12px',
                                    borderRadius: 12,
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    marginBottom: -4 // Slight adjustment for optical alignment
                                }}>
                                    {referralCode && (
                                        <Stack gap={0} align="flex-end" mr={4}>
                                            <Text size="10px" color="#a6a7ab" fw={800} tt="uppercase" style={{ letterSpacing: 0.5, opacity: 0.8 }}>Referral</Text>
                                            <Text size="sm" fw={800} color="#339af0" style={{ letterSpacing: -0.2 }}>{referralCode}</Text>
                                        </Stack>
                                    )}

                                    <Box style={{
                                        background: 'white',
                                        padding: 4,
                                        borderRadius: 8,
                                        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <QRCodeSVG
                                            value={`https://www.vircex.com/register?ref=${referralCode || ''}`}
                                            size={44}
                                            level="H"
                                            imageSettings={{
                                                src: "/icon.png",
                                                x: undefined,
                                                y: undefined,
                                                height: 10,
                                                width: 10,
                                                excavate: true,
                                            }}
                                        />
                                    </Box>
                                </Group>
                            </Group>
                        </Box>
                    </Paper>
                </Box>

                {/* Display Section */}
                <Box
                    style={{
                        minHeight: 320,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.05)',
                        borderRadius: 'var(--mantine-radius-md)',
                        overflow: 'hidden'
                    }}
                >
                    {loading ? (
                        <Stack align="center" gap="sm">
                            <Loader size="sm" />
                            <Text size="xs" c="dimmed">Generating secure card...</Text>
                        </Stack>
                    ) : generatedImage ? (
                        <img
                            src={generatedImage}
                            alt="PNL Card"
                            style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                    ) : (
                        <Text size="xs" c="red">Failed to generate preview</Text>
                    )}
                </Box>

                {/* Action Buttons */}
                <Group grow>
                    <Button
                        leftSection={<IconDownload size={18} />}
                        onClick={handleDownload}
                        variant="light"
                        radius="md"
                        size="md"
                        disabled={!generatedImage}
                    >
                        Download Image
                    </Button>
                    <Button
                        leftSection={<IconShare size={18} />}
                        variant="filled"
                        color="blue"
                        radius="md"
                        size="md"
                        disabled={!generatedImage}
                    >
                        Share to X
                    </Button>
                </Group>
            </Stack>
        </Modal>
    )
}
