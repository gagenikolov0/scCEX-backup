import { Link, NavLink } from 'react-router-dom'
import { IconHome2, IconUser, IconSun, IconMoon } from '@tabler/icons-react'
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
  ActionIcon,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import classes from './HeaderMegaMenu.module.css'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const toggleTheme = () => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
  const { isAuthed } = useAuth()
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false)
  const [futuresOpen, { toggle: toggleFutures }] = useDisclosure(false)
  const [spotOpen, { toggle: toggleSpot }] = useDisclosure(false)

  // Home icon: prefer custom /icon.png from public, fallback to Tabler icon
  function HomeIcon() {
    const [loaded, setLoaded] = useState(false)
    useEffect(() => {
      const img = new Image()
      img.onload = () => setLoaded(true)
      img.onerror = () => setLoaded(false)
      img.src = '/icon.png'
    }, [])
    return loaded
      ? <img src="/icon.png" alt="Home" className={classes.homeIcon} />
      : <IconHome2 className={classes.homeIcon} size={24} />
  }

  return (
    <header className={classes.header}>
      <Group justify="space-between" h="100%">
        {/* Left: Home icon and menus (desktop only) */}
        <Group h="100%" gap={0} visibleFrom="sm">
          <Anchor component={Link} to="/" className={`${classes.trigger} ${classes.homeTrigger}`} aria-label="Home">
            <HomeIcon />
          </Anchor>

          <NavLink to="/markets" className={({ isActive }) => `${classes.trigger} ${classes.pill} ${isActive ? classes.pillActive : ''}`} aria-label="Markets">
            Markets
          </NavLink>

          {/* Desktop menus only */}
          <Group h="100%" gap={0}>
            {/* Futures hover menu */}
            <HoverCard width={260} position="bottom" radius="md" shadow="md" withinPortal openDelay={50} closeDelay={50} transitionProps={{ duration: 220 }}>
              <HoverCard.Target>
                <span className={classes.trigger}>
                  <Center inline>
                    <Box component="span" mr={5}>Futures</Box>
                  </Center>
                </span>
              </HoverCard.Target>
              <HoverCard.Dropdown>
                <div className="grid gap-2">
                  <Anchor component={Link} to="/futures?quote=USDT">USDT Perps</Anchor>
                  <Anchor component={Link} to="/futures?quote=USDC">USDC Perps</Anchor>
                </div>
              </HoverCard.Dropdown>
            </HoverCard>

            {/* Spot hover menu */}
            <HoverCard width={220} position="bottom" radius="md" shadow="md" withinPortal openDelay={50} closeDelay={50} transitionProps={{ duration: 220 }}>
              <HoverCard.Target>
                <span className={classes.trigger}>
                  <Center inline>
                    <Box component="span" mr={5}>Spot</Box>
                  </Center>
                </span>
              </HoverCard.Target>
              <HoverCard.Dropdown>
                <div className="grid gap-2">
                  <Anchor component={Link} to="/spot?quote=USDT">USDT</Anchor>
                  <Anchor component={Link} to="/spot?quote=USDC">USDC</Anchor>
                </div>
              </HoverCard.Dropdown>
            </HoverCard>
          </Group>
        </Group>

        {/* Right: auth links */}
        <Group visibleFrom="sm">
          {isAuthed ? (
            <>
              <NavLink to="/wallet" className={({ isActive }) => `${classes.trigger} ${classes.pill} ${isActive ? classes.pillActive : ''}`}>Wallet</NavLink>
              <ActionIcon component={Link} to="/settings" variant="subtle" radius="xl" size="lg" aria-label="User settings">
                <IconUser size={18} />
              </ActionIcon>
              <ActionIcon onClick={toggleTheme} variant="subtle" radius="xl" size="lg" aria-label="Toggle theme">
                {colorScheme === 'dark' ? <IconMoon size={18} /> : <IconSun size={18} />}
              </ActionIcon>
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
          <NavLink to="/markets" className={classes.link} onClick={closeDrawer}>Markets</NavLink>

          <Button variant="subtle" className={classes.link} onClick={toggleFutures}>Futures</Button>
          <Collapse in={futuresOpen}>
            <div className="grid gap-1 pl-4">
              <NavLink to="/futures?quote=USDT" onClick={closeDrawer}>USDT Perps</NavLink>
              <NavLink to="/futures?quote=USDC" onClick={closeDrawer}>USDC Perps</NavLink>
            </div>
          </Collapse>

          <Button variant="subtle" className={classes.link} onClick={toggleSpot}>Spot</Button>
          <Collapse in={spotOpen}>
            <div className="grid gap-1 pl-4">
              <NavLink to="/spot?quote=USDT" onClick={closeDrawer}>USDT</NavLink>
              <NavLink to="/spot?quote=USDC" onClick={closeDrawer}>USDC</NavLink>
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
