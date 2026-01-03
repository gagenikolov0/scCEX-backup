import { Link, NavLink } from 'react-router-dom'
import { IconUser, IconSun, IconMoon, IconCurrencyDollar, IconCoin } from '@tabler/icons-react'
import {
  Anchor,
  Box,
  Burger,
  Button,
  Center,
  Collapse,
  Divider,
  Drawer,
  Group,
  Menu,
  ScrollArea,
  ActionIcon,
  useMantineColorScheme,
  Stack,
  UnstyledButton,
  ThemeIcon,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

import classes from './HeaderMegaMenu.module.css'
import { useAuth } from '../contexts/AuthContext'

// Home icon: prefer custom /icon.png from public
function HomeIcon() {
  return (
    <Center w={24} h={24}>
      <img
        src="/icon.png"
        alt="Home"
        style={{ width: 24, height: 24, objectFit: 'contain' }}
        className={classes.homeIcon}
      />
    </Center>
  )
}

function DropdownItem({ title, description, icon, to }: any) {
  return (
    <Menu.Item component={Link} to={to} className={classes.dropdownItem}>
      <Group wrap="nowrap" align="center">
        <ThemeIcon size={34} variant="default" radius="md">
          {icon}
        </ThemeIcon>
        <div>
          <Text size="sm" fw={500}>
            {title}
          </Text>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </div>
      </Group>
    </Menu.Item>
  )
}

function MobileNavItem({ title, description, icon, to, onClick }: any) {
  return (
    <UnstyledButton component={NavLink} to={to} onClick={onClick} className={classes.dropdownItem}>
      <Group wrap="nowrap" align="center">
        <ThemeIcon size={34} variant="default" radius="md">
          {icon}
        </ThemeIcon>
        <div>
          <Text size="sm" fw={500}>
            {title}
          </Text>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </div>
      </Group>
    </UnstyledButton>
  )
}

export default function Header() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const toggleTheme = () => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
  const { isAuthed } = useAuth()
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false)
  const [futuresOpen, { toggle: toggleFutures }] = useDisclosure(false)
  const [spotOpen, { toggle: toggleSpot }] = useDisclosure(false)

  return (
    <Box component="header" className={classes.header}>
      <Group justify="space-between" h="100%">
        {/* Left: Home icon (always visible) and menus (desktop only) */}
        <Group h="100%" gap={0}>
          <Anchor component={Link} to="/" className={`${classes.trigger} ${classes.homeTrigger}`} aria-label="Home">
            <HomeIcon />
          </Anchor>

          <Group h="100%" gap={0} visibleFrom="sm">
            <NavLink to="/markets" className={({ isActive }) => `${classes.trigger} ${classes.pill} ${isActive ? classes.pillActive : ''}`} aria-label="Markets">
              Markets
            </NavLink>

            {/* Desktop menus only */}
            <Group h="100%" gap={0}>
              {/* Futures hover menu */}
              <Menu
                trigger="hover"
                openDelay={50}
                closeDelay={50}
                width={300}
                position="bottom-start"
                radius="md"
                shadow="md"
                withinPortal
              >
                <Menu.Target>
                  <Box component="span" className={classes.trigger}>
                    <Center inline>
                      <Box component="span" mr={5}>Futures</Box>
                    </Center>
                  </Box>
                </Menu.Target>
                <Menu.Dropdown p={4}>
                  <DropdownItem
                    to="/futures?quote=USDT"
                    title="USDT-M Futures"
                    description="Trade perpetual contracts settled in USDT"
                    icon={<IconCurrencyDollar size={20} color="var(--mantine-color-green-6)" />}
                  />
                  <DropdownItem
                    to="/futures?quote=USDC"
                    title="USDC-M Futures"
                    description="Trade perpetual contracts settled in USDC"
                    icon={<IconCoin size={20} color="var(--mantine-color-blue-6)" />}
                  />
                </Menu.Dropdown>
              </Menu>

              {/* Spot hover menu */}
              <Menu
                trigger="hover"
                openDelay={50}
                closeDelay={50}
                width={300}
                position="bottom-start"
                radius="md"
                shadow="md"
                withinPortal
              >
                <Menu.Target>
                  <Box component="span" className={classes.trigger}>
                    <Center inline>
                      <Box component="span" mr={5}>Spot</Box>
                    </Center>
                  </Box>
                </Menu.Target>
                <Menu.Dropdown p={4}>
                  <DropdownItem
                    to="/spot?quote=USDT"
                    title="USDT Market"
                    description="Trade top tokens with USDT pairs"
                    icon={<IconCurrencyDollar size={20} color="var(--mantine-color-green-6)" />}
                  />
                  <DropdownItem
                    to="/spot?quote=USDC"
                    title="USDC Market"
                    description="Trade top tokens with USDC pairs"
                    icon={<IconCoin size={20} color="var(--mantine-color-blue-6)" />}
                  />
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </Group>

        {/* Right: auth links (desktop) */}
        <Group visibleFrom="sm">
          {isAuthed ? (
            <>
              <Button component={Link} to="/deposit" color="blue" radius="xl" size="xs" px="md">Deposit</Button>
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

        {/* Mobile Right Section: [Theme] [User] [Burger] */}
        <Group gap={5} hiddenFrom="sm">
          {isAuthed && (
            <>
              <ActionIcon onClick={toggleTheme} variant="subtle" radius="xl" size="lg" aria-label="Toggle theme">
                {colorScheme === 'dark' ? <IconMoon size={18} /> : <IconSun size={18} />}
              </ActionIcon>
              <ActionIcon component={Link} to="/settings" variant="subtle" radius="xl" size="lg" aria-label="User settings">
                <IconUser size={18} />
              </ActionIcon>
            </>
          )}
          <Burger opened={drawerOpened} onClick={toggleDrawer} size="sm" />
        </Group>
      </Group>

      <Drawer opened={drawerOpened} onClose={closeDrawer} size="100%" padding="md" title="Navigation" hiddenFrom="sm" zIndex={1000000}>
        <ScrollArea h="calc(100vh - 80px)" mx="-md">
          <Divider my="sm" />
          <NavLink to="/markets" className={classes.link} onClick={closeDrawer}>Markets</NavLink>

          <Button variant="subtle" className={classes.link} onClick={toggleFutures}>Futures</Button>
          <Collapse in={futuresOpen}>
            <Stack gap={0} pl="md">
              <MobileNavItem
                to="/futures?quote=USDT"
                title="USDT-M Futures"
                description="Trade perpetual contracts settled in USDT"
                icon={<IconCurrencyDollar size={20} color="var(--mantine-color-green-6)" />}
                onClick={closeDrawer}
              />
              <MobileNavItem
                to="/futures?quote=USDC"
                title="USDC-M Futures"
                description="Trade perpetual contracts settled in USDC"
                icon={<IconCoin size={20} color="var(--mantine-color-blue-6)" />}
                onClick={closeDrawer}
              />
            </Stack>
          </Collapse>

          <Button variant="subtle" className={classes.link} onClick={toggleSpot}>Spot</Button>
          <Collapse in={spotOpen}>
            <Stack gap={0} pl="md">
              <MobileNavItem
                to="/spot?quote=USDT"
                title="USDT Market"
                description="Trade top tokens with USDT pairs"
                icon={<IconCurrencyDollar size={20} color="var(--mantine-color-green-6)" />}
                onClick={closeDrawer}
              />
              <MobileNavItem
                to="/spot?quote=USDC"
                title="USDC Market"
                description="Trade top tokens with USDC pairs"
                icon={<IconCoin size={20} color="var(--mantine-color-blue-6)" />}
                onClick={closeDrawer}
              />
            </Stack>
          </Collapse>

          <Divider my="sm" />
          <Group justify="center" grow pb="xl" px="md">
            {isAuthed ? (
              <>
                <Button variant="default" component={Link} to="/wallet" onClick={closeDrawer}>Wallet</Button>
                <Button variant="default" component={Link} to="/deposit" onClick={closeDrawer}>Deposit</Button>
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
    </Box>
  )
}
