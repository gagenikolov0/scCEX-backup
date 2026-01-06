
import { Slider, Box, Group } from '@mantine/core'

interface TradeSliderProps {
    value: number
    onChange: (val: number) => void
}

export default function TradeSlider({ value, onChange }: TradeSliderProps) {
    const marks = [
        { value: 0, label: '' },
        { value: 25, label: '' },
        { value: 50, label: '' },
        { value: 75, label: '' },
        { value: 100, label: '' },
    ]

    return (
        <Box mb="md">
            <Slider
                value={value}
                onChange={onChange}
                step={1}
                min={0}
                max={100}
                label={(val) => `${val}%`}
                marks={marks}
                size="sm"
                thumbSize={18}
                styles={{
                    track: { backgroundColor: 'var(--mantine-color-default-border)' },
                    bar: { backgroundColor: 'var(--mantine-primary-color-filled)' },
                    thumb: { borderWidth: 2, padding: 0, borderColor: 'var(--mantine-primary-color-filled)' }
                }}
            />
            <Group grow gap="xs" mt="xs">
                {[25, 50, 75, 100].map(pct => (
                    <Box
                        key={pct}
                        onClick={() => onChange(pct)}
                        style={{
                            cursor: 'pointer',
                            fontSize: '10px',
                            textAlign: 'center',
                            padding: '4px 0',
                            borderRadius: '4px',
                            backgroundColor: value === pct ? 'var(--mantine-primary-color-light)' : 'var(--mantine-color-default-hover)',
                            color: value === pct ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-dimmed)',
                            fontWeight: 700,
                            transition: 'all 0.1s'
                        }}
                    >
                        {pct}%
                    </Box>
                ))}
            </Group>
        </Box>
    )
}
