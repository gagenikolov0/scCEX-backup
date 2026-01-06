import { Center } from '@mantine/core'

interface CustomLoaderProps {
    fullScreen?: boolean
    size?: number
}

export function CustomLoader({ fullScreen = true, size = 80 }: CustomLoaderProps) {
    return (
        <Center h={fullScreen ? '100vh' : '100%'} w="100%">
            <div className="loader-container" style={{ width: size, height: size }}>
                <div className="loader-ring"></div>
                <img src="/icon.png" alt="Loading..." className="loader-logo" style={{ width: size * 0.45, height: size * 0.45 }} />
            </div>
        </Center>
    )
}
