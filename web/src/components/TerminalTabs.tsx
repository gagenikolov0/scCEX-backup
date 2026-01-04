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
            <Tabs defaultValue={defaultValue} variant="pills" radius="md" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Tabs.List pt={4} px={4} style={{ flexShrink: 0 }}>
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
