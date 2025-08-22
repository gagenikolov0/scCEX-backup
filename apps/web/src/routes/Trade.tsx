// Trading shell scaffold (Mantine components)
import { Card, TextInput, Button, Grid, Menu } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'

export default function Trade() {
  const [search] = useSearchParams()
  const quote = (search.get('quote') || 'USDT').toUpperCase()
  const market = (search.get('market') || 'futures').toLowerCase()
  const [token, setToken] = useState('BTC')
  const tokenOptions = useMemo(() => ['BTC','ETH','SOL','XRP'], [])

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Menu shadow="md" width={180}>
          <Menu.Target>
            <Button variant="outline" size="compact-md" className="h-10">
              <div className="leading-tight text-left">
                <div className="text-sm font-medium">{token}/{quote}</div>
                {market === 'futures' && (
                  <div className="text-[11px] text-neutral-500">Perpetual</div>
                )}
              </div>
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {tokenOptions.map((t) => (
              <Menu.Item key={t} onClick={() => setToken(t)}>
                {t}/{quote}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </div>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card padding={0} radius="md" withBorder>
          <div className="h-[420px]">
            {/* TradingView chart placeholder */}
            <div className="h-full w-full bg-neutral-100 dark:bg-neutral-900 grid place-items-center text-sm text-neutral-500">
              Chart ({token}/{quote})
            </div>
          </div>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Order Book</div>
            <div className="p-3 h-[200px] overflow-auto text-sm">
              {/* Order book placeholder */}
              <div className="grid grid-cols-3 gap-y-1">
                <div className="text-red-600">50,000</div><div>12.4</div><div>623k</div>
                <div className="text-red-600">49,900</div><div>3.7</div><div>185k</div>
                <div className="text-green-600">49,800</div><div>8.1</div><div>403k</div>
              </div>
            </div>
          </Card>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Recent Trades</div>
            <div className="p-3 h-[160px] overflow-auto text-sm">
              <div className="grid grid-cols-3 gap-y-1">
                <div className="text-green-600">49,820</div><div>0.12</div><div>12:01:03</div>
                <div className="text-red-600">49,810</div><div>0.08</div><div>12:00:57</div>
              </div>
            </div>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card padding={0} radius="md" withBorder>
          <div className="p-3 border-b text-sm font-medium">Trade</div>
          <div className="p-4 grid gap-3">
            <div className="grid gap-1">
              <TextInput id="qty" label="Quantity" placeholder="0.00" />
            </div>
            <div className="grid gap-1">
              <TextInput id="lev" label="Leverage" placeholder="x10" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" variant="light" color="teal">Buy</Button>
              <Button className="flex-1" color="red">Sell</Button>
            </div>
          </div>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card padding={0} radius="md" withBorder>
          <div className="p-3 border-b text-sm font-medium">Positions & Orders</div>
          <div className="p-4 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-neutral-500">
                <tr className="text-left">
                  <th className="py-2 pr-3">Symbol</th>
                  <th className="py-2 pr-3">Side</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Entry</th>
                  <th className="py-2 pr-3">Liq</th>
                  <th className="py-2 pr-3">uPNL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="py-2 pr-3">BTC/USDT Perp</td>
                  <td className="py-2 pr-3 text-green-600">Long</td>
                  <td className="py-2 pr-3">0.50 BTC x10</td>
                  <td className="py-2 pr-3">49,800</td>
                  <td className="py-2 pr-3">45,200</td>
                  <td className="py-2 pr-3 text-green-600">+123.40</td>
                </tr>
              </tbody>
            </table>
          </div>
          </Card>
        </Grid.Col>
      </Grid>
    </div>
  )
}


