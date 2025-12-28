import { Slider, Box } from '@mantine/core'

interface TradeSliderProps {
    value: number
    onChange: (val: number) => void
}

export default function TradeSlider({ value, onChange }: TradeSliderProps) {
    return (
        <Box py="xs" mb="lg">
            <Slider
                value={value}
                onChange={onChange}
                step={1}
                min={0}
                max={100}
                label={(val) => `${val}%`}
                marks={[
                    { value: 0, label: '0%' },
                    { value: 25, label: '25%' },
                    { value: 50, label: '50%' },
                    { value: 75, label: '75%' },
                    { value: 100, label: '100%' },
                ]}
                styles={{
                    markLabel: { fontSize: 'var(--mantine-font-size-xxs)', marginTop: 'var(--mantine-spacing-xs)' },
                    thumb: { borderWidth: 2, padding: 3 }
                }}
            />
        </Box>
    )
}
