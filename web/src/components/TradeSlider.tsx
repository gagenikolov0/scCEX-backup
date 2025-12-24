import { Slider } from '@mantine/core'

interface TradeSliderProps {
    value: number
    onChange: (val: number) => void
}

export default function TradeSlider({ value, onChange }: TradeSliderProps) {
    return (
        <div className="py-1">
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
                    markLabel: { fontSize: '10px', marginTop: '4px' },
                    thumb: { borderWidth: 2, padding: 3 },
                    root: { marginBottom: '16px' }
                }}
            />
        </div>
    )
}
