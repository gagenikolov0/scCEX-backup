import { Tabs, Card } from '@mantine/core'

/**
 * Institutional-grade Tabs component for Trading Terminals.
 * Encapsulates standard styling and behavior for Spot and Futures.
 */

interface TabItem {
    value: string
    label: string
    onClick?: () => void
}

interface TerminalTabsProps {
    defaultValue: string
    tabs: TabItem[]
    children: React.ReactNode
    height?: number | string
}

export function TerminalTabs({ defaultValue, tabs, children, height = 525 }: TerminalTabsProps) {
    return (
        <Card padding={0} withBorder radius="md" h={height} style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }} shadow="xs">
            <Tabs
                defaultValue={defaultValue}
                variant="default"
                radius="none"
                style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                styles={() => ({
                    list: {
                        backgroundColor: 'var(--bg-2)',
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                        height: '42px',
                        gap: 0
                    },
                    tab: {
                        height: '41px', // 1px less than container to sit on border
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        color: 'var(--mantine-color-dimmed)',
                        letterSpacing: '0.05em',
                        padding: '0 16px',
                        borderRadius: 0,
                        borderBottom: '2px solid transparent',
                        marginBottom: '-1px', // Pull down to cover bottom border
                        '&:hover': {
                            backgroundColor: 'transparent',
                            color: 'var(--mantine-color-text)'
                        },
                        '&[data-active]': {
                            borderColor: 'var(--mantine-color-blue-filled)',
                            color: 'var(--mantine-color-text)',
                            backgroundColor: 'transparent'
                        }
                    }
                })}
            >
                <Tabs.List>
                    {tabs.map(tab => (
                        <Tabs.Tab key={tab.value} value={tab.value} onClick={tab.onClick}>
                            {tab.label}
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
                {/* Content Area - Flex Grow to fill remaining space */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {children}
                </div>
            </Tabs>
        </Card>
    )
}
