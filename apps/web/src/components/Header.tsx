import { Link, NavLink } from 'react-router-dom'
import { IconChevronDown, IconHome2 } from '@tabler/icons-react'
import {
  Anchor,
  Box,
  Button,
  Center,
  Collapse,
  Divider,
  Drawer,
  Group,
  HoverCard,
  ScrollArea,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import classes from './HeaderMegaMenu.module.css'
import { useAuth } from '../auth/AuthContext'

export default function Header() {
  const { isAuthed } = useAuth()
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false)
  const [futuresOpen, { toggle: toggleFutures }] = useDisclosure(false)
  const [spotOpen, { toggle: toggleSpot }] = useDisclosure(false)

  return (
    <header className={classes.header}>
      <Group justify="space-between" h="100%">
        {/* Left: Home icon and menus */}
        <Group h="100%" gap={0}>
          <Anchor component={Link} to="/" className={classes.link} aria-label="Home">
            <IconHome2 size={18} />
          </Anchor>

          {/* Futures hover menu */}
          <HoverCard width={260} position="bottom" radius="md" shadow="md" withinPortal>
            <HoverCard.Target>
              <a className={classes.link}>
                <Center inline>
                  <Box component="span" mr={5}>Futures</Box>
                  <IconChevronDown size={16} />
                </Center>
              </a>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <div className="grid gap-2">
                <Anchor component={Link} to="/trade?market=futures&quote=USDT">USDT Perps</Anchor>
                <Anchor component={Link} to="/trade?market=futures&quote=USDC">USDC Perps</Anchor>
              </div>
            </HoverCard.Dropdown>
          </HoverCard>

          {/* Spot hover menu */}
          <HoverCard width={220} position="bottom" radius="md" shadow="md" withinPortal>
            <HoverCard.Target>
              <a className={classes.link}>
                <Center inline>
                  <Box component="span" mr={5}>Spot</Box>
                  <IconChevronDown size={16} />
                </Center>
              </a>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <div className="grid gap-2">
                <Anchor component={Link} to="/trade?market=spot&quote=USDT">USDT</Anchor>
                <Anchor component={Link} to="/trade?market=spot&quote=USDC">USDC</Anchor>
              </div>
            </HoverCard.Dropdown>
          </HoverCard>
        </Group>

        {/* Right: auth links */}
        <Group visibleFrom="sm">
          {isAuthed ? (
            <>
              <Button variant="default" component={Link} to="/wallet">Wallet</Button>
              <Button variant="default" component={Link} to="/settings">Settings</Button>
            </>
          ) : (
            <>
              <Button variant="default" component={Link} to="/login">Login</Button>
              <Button component={Link} to="/register">Sign up</Button>
            </>
          )}
        </Group>

        {/* Mobile burger */}
        <Button onClick={toggleDrawer} hiddenFrom="sm" variant="subtle" size="compact-sm">Menu</Button>
      </Group>

      <Drawer opened={drawerOpened} onClose={closeDrawer} size="100%" padding="md" title="Navigation" hiddenFrom="sm" zIndex={1000000}>
        <ScrollArea h="calc(100vh - 80px)" mx="-md">
          <Divider my="sm" />
          <NavLink to="/" className={classes.link} onClick={closeDrawer}>Home</NavLink>

          <Button variant="subtle" className={classes.link} onClick={toggleFutures}>Futures</Button>
          <Collapse in={futuresOpen}>
            <div className="grid gap-1 pl-4">
              <NavLink to="/trade?market=futures&quote=USDT" onClick={closeDrawer}>USDT Perps</NavLink>
              <NavLink to="/trade?market=futures&quote=USDC" onClick={closeDrawer}>USDC Perps</NavLink>
            </div>
          </Collapse>

          <Button variant="subtle" className={classes.link} onClick={toggleSpot}>Spot</Button>
          <Collapse in={spotOpen}>
            <div className="grid gap-1 pl-4">
              <NavLink to="/trade?market=spot&quote=USDT" onClick={closeDrawer}>USDT</NavLink>
              <NavLink to="/trade?market=spot&quote=USDC" onClick={closeDrawer}>USDC</NavLink>
            </div>
          </Collapse>

          <Divider my="sm" />
          <Group justify="center" grow pb="xl" px="md">
            {isAuthed ? (
              <>
                <Button variant="default" component={Link} to="/wallet" onClick={closeDrawer}>Wallet</Button>
                <Button variant="default" component={Link} to="/settings" onClick={closeDrawer}>Settings</Button>
              </>
            ) : (
              <>
                <Button variant="default" component={Link} to="/login" onClick={closeDrawer}>Login</Button>
                <Button component={Link} to="/register" onClick={closeDrawer}>Sign up</Button>
              </>
            )}
          </Group>
        </ScrollArea>
      </Drawer>
    </header>
  )
}
