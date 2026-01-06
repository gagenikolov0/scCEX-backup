import { Link, NavLink, useNavigate } from 'react-router-dom'
import { IconUser, IconSun, IconMoon, IconCurrencyDollar, IconCoin, IconSearch, IconHash, IconWallet, IconArrowUpRight, IconArrowUp, IconActivity } from '@tabler/icons-react'
import { useEffect, useState, useRef, useMemo } from 'react'
import {
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
  Badge,
  SimpleGrid,
  Select,
  Avatar,
  Loader,
  Modal,
} from '@mantine/core'
import { useDisclosure, useDebouncedValue, useHotkeys } from '@mantine/hooks'

import classes from './HeaderMegaMenu.module.css'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { API_BASE } from '../config/api'
import { CountUp } from './CountUp'

// Home icon: prefer custom /icon.png from public
// Home icon: prefer custom /icon.png from public
function HomeIcon({ size = 28, style, ...props }: any) {
  return (
    <Center w={size} h={size} style={style} {...props}>
      <img
        src="/icon.png"
        alt="Home"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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

function WalletDropdownContent() {
  const { totalPortfolioUSD, spotEquity, futuresEquity } = useAccount()

  return (
    <Stack gap="md">
      <UnstyledButton component={Link} to="/wallet?tab=overview" className={classes.dropdownItem}>
        <Box>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Balance</Text>
          <CountUp
            end={totalPortfolioUSD}
            prefix="$"
            decimals={2}
            size="xl"
            fw={800}
            className="text-glow"
          />
          <Group gap="xs" mt={4}>
            <Badge size="xs" variant="dot" color="cyan">Spot: ${spotEquity.toFixed(2)}</Badge>
            <Badge size="xs" variant="dot" color="blue">Fut: ${futuresEquity.toFixed(2)}</Badge>
          </Group>
        </Box>
      </UnstyledButton>

      <Divider />

      <SimpleGrid cols={2}>
        <Button component={Link} to="/deposit" leftSection={<IconArrowUpRight size={16} />} variant="light" color="green" size="xs">Deposit</Button>
        <Button component={Link} to="/withdraw" leftSection={<IconArrowUp size={16} />} variant="light" color="red" size="xs">Withdraw</Button>
      </SimpleGrid>

      <Divider />

      <Stack gap={4}>
        <Menu.Item component={Link} to="/wallet?tab=overview" leftSection={<IconWallet size={18} />} py="md" fz="sm">Overview</Menu.Item>
        <Menu.Item component={Link} to="/wallet?tab=spot" leftSection={<IconCoin size={18} />} py="md" fz="sm">Spot Wallet</Menu.Item>
        <Menu.Item component={Link} to="/wallet?tab=futures" leftSection={<IconCurrencyDollar size={18} />} py="md" fz="sm">Futures Wallet</Menu.Item>
      </Stack>
    </Stack>
  )
}

// Pre-defined asset list - REMOVED hardcoded BTC references
const ASSETS: any[] = [];

export default function Header() {
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300)
  const [userResults, setUserResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const hasRefreshedRef = useRef(false)

  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const toggleTheme = () => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
  const { isAuthed, accessToken } = useAuth()
  const { username, refreshBalances } = useAccount()
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false)
  const [futuresOpen, { toggle: toggleFutures }] = useDisclosure(false)
  const [spotOpen, { toggle: toggleSpot }] = useDisclosure(false)
  const [searchOpened, { open: openSearch, close: closeSearch }] = useDisclosure(false)

  useHotkeys([['mod+K', () => searchInputRef.current?.focus()]])

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setUserResults([])
      return
    }

    const fetchUsers = async () => {
      if (!accessToken) return
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/user/search?q=${encodeURIComponent(debouncedQuery)}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.users) {
            setUserResults(data.users.map((u: any) => ({
              value: `/trader/${u.username}`,
              label: u.username,
              category: 'Traders',
              image: u.profilePicture
            })))
          }
        }
      } catch (e) {
        console.error('Search error:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [debouncedQuery, accessToken])

  const combinedData = useMemo(() => {
    if (searchQuery.trim().length === 0 && userResults.length === 0) return []

    const filteredAssets = ASSETS.filter(a => a.label.toLowerCase().includes(searchQuery.toLowerCase()))

    // Return a flat array. In Mantine v7, having a 'group' property on an item
    // that is NOT a group header causes a crash because it expects 'items'.
    // We used 'category' instead.
    return [...filteredAssets, ...userResults]
  }, [searchQuery, userResults])

  const renderSelect = (ref?: any, autoFocus?: boolean) => (
    <Select
      ref={ref}
      placeholder="Search assets or traders (Ctrl + K)"
      leftSection={<IconSearch size={16} stroke={1.5} />}
      data={combinedData}
      searchable
      autoFocus={autoFocus}
      onSearchChange={setSearchQuery}
      searchValue={searchQuery}
      onChange={(value) => {
        if (value) {
          navigate(value)
          // Use a small delay to clear search query to prevent Mantine Select 
          // from crashing during its internal cleanup while navigation occurs
          setTimeout(() => {
            setSearchQuery('')
            closeSearch()
          }, 50)
        }
      }}
      nothingFoundMessage="No assets or traders found"
      rightSection={loading ? <Loader size={16} /> : null}
      renderOption={({ option }) => {
        if (!option) return null;
        const isTrader = (option as any).category === 'Traders';

        return (
          <Group gap="sm">
            {isTrader ? (
              <Avatar src={(option as any).image} size={24} radius="xl" />
            ) : (
              <ThemeIcon variant="light" size={24} radius="xl">
                <IconHash size={14} />
              </ThemeIcon>
            )}
            <div>
              <Text size="sm">{option.label}</Text>
              <Text size="xs" c="dimmed">{(option as any).category}</Text>
            </div>
          </Group>
        );
      }}
      styles={{
        input: {
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-1)',
          borderRadius: 'var(--mantine-radius-xl)',
          transition: 'all 0.2s ease',
          '&:focus': {
            borderColor: 'var(--mantine-primary-color-filled)',
            boxShadow: '0 0 0 2px rgba(51, 154, 240, 0.1)'
          }
        },
        dropdown: {
          backgroundColor: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--mantine-radius-md)',
          boxShadow: '0 10px 40px var(--glass-shadow)'
        }
      }}
    />
  )

  return (
    <Box component="header" className={classes.header}>
      <Group justify="space-between" h="100%" wrap="nowrap">
        {/* Left: Home & Navigation */}
        <Group h="100%" gap={0} wrap="nowrap">
          <UnstyledButton
            component={Link}
            to="/"
            aria-label="Home"
            style={{ display: 'flex', alignItems: 'center', marginTop: '-4px' }}
          >
            <Group gap={6} align="center" wrap="nowrap">
              <HomeIcon size={24} style={{ marginTop: 4 }} />
              <Text
                visibleFrom="sm"
                size="22px"
                fw={900}
                variant="gradient"
                gradient={{ from: 'cyan.4', to: 'blue.6', deg: 120 }}
                style={{
                  letterSpacing: '-0.5px',
                  userSelect: 'none',
                  lineHeight: 1
                }}
              >
                Vircex
              </Text>
            </Group>
          </UnstyledButton>

          <Group h="100%" gap={0} visibleFrom="sm" ml="md">
            <NavLink to="/markets" className={({ isActive }) => `${classes.trigger} ${classes.pill} ${isActive ? classes.pillActive : ''}`} aria-label="Markets">
              Markets
            </NavLink>

            <Menu trigger="hover" openDelay={50} closeDelay={50} width={300} position="bottom-start" radius="md" shadow="md" withinPortal
              styles={{
                dropdown: {
                  backgroundColor: 'var(--glass-bg)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: '0 10px 40px var(--glass-shadow)'
                }
              }}
            >
              <Menu.Target>
                <Box component="span" className={classes.trigger}>
                  <Center inline>
                    <Box component="span" mr={5}>Futures</Box>
                  </Center>
                </Box>
              </Menu.Target>
              <Menu.Dropdown p={4}>
                <DropdownItem to="/futures?quote=USDT" title="USDT-M Futures" description="Trade perpetual contracts settled in USDT" icon={<IconCurrencyDollar size={20} color="var(--mantine-color-green-6)" />} />
                <DropdownItem to="/futures?quote=USDC" title="USDC-M Futures" description="Trade perpetual contracts settled in USDC" icon={<IconCoin size={20} color="var(--mantine-color-blue-6)" />} />
              </Menu.Dropdown>
            </Menu>

            <Menu trigger="hover" openDelay={50} closeDelay={50} width={300} position="bottom-start" radius="md" shadow="md" withinPortal
              styles={{
                dropdown: {
                  backgroundColor: 'var(--glass-bg)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: '0 10px 40px var(--glass-shadow)'
                }
              }}
            >
              <Menu.Target>
                <Box component="span" className={classes.trigger}>
                  <Center inline>
                    <Box component="span" mr={5}>Spot</Box>
                  </Center>
                </Box>
              </Menu.Target>
              <Menu.Dropdown p={4}>
                <DropdownItem to="/spot?quote=USDT" title="USDT Market" description="Trade top tokens with USDT pairs" icon={<IconCurrencyDollar size={20} color="var(--mantine-color-green-6)" />} />
                <DropdownItem to="/spot?quote=USDC" title="USDC Market" description="Trade top tokens with USDC pairs" icon={<IconCoin size={20} color="var(--mantine-color-blue-6)" />} />
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Middle: Omni Search Bar */}
        <Box style={{ flex: 1, maxWidth: 320, margin: '0 20px' }} visibleFrom="sm">
          {renderSelect(searchInputRef)}
        </Box>

        {/* Right Section: Auth & Settings */}
        <Group wrap="nowrap">
          {/* Mobile Search Icon */}
          <ActionIcon
            hiddenFrom="sm"
            variant="default"
            radius="xl"
            size="lg"
            onClick={openSearch}
            aria-label="Search"
            style={{ border: 'none', background: 'transparent' }}
          >
            <IconSearch size={22} color="var(--mantine-color-text)" />
          </ActionIcon>

          <Group visibleFrom="sm" gap="xs" wrap="nowrap">
            {isAuthed ? (
              <>
                <Button component={Link} to="/deposit" color="blue" radius="xl" size="xs" px="md">Deposit</Button>
                <Menu trigger="hover" openDelay={50} closeDelay={50} width={300} position="bottom-end" radius="lg" shadow="lg" withinPortal
                  styles={{
                    dropdown: {
                      backgroundColor: 'var(--glass-bg)',
                      backdropFilter: 'blur(var(--glass-blur))',
                      border: '1px solid var(--glass-border)',
                      boxShadow: '0 20px 40px var(--glass-shadow)'
                    }
                  }}
                >
                  <Menu.Target>
                    <UnstyledButton
                      component={Link}
                      to="/wallet"
                      className={classes.trigger}
                      onMouseEnter={() => {
                        if (!hasRefreshedRef.current) {
                          refreshBalances()
                          hasRefreshedRef.current = true
                        }
                      }}
                      onMouseLeave={() => {
                        hasRefreshedRef.current = false
                      }}
                    >
                      <Center inline>
                        <Box component="span" mr={5}>Wallet</Box>
                      </Center>
                    </UnstyledButton>
                  </Menu.Target>
                  <Menu.Dropdown p="md">
                    <WalletDropdownContent />
                  </Menu.Dropdown>
                </Menu>

                <Menu trigger="hover" openDelay={50} closeDelay={50} width={200} position="bottom-end" radius="md" shadow="md" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="subtle" radius="xl" size="lg" aria-label="User settings">
                      <IconUser size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Account</Menu.Label>
                    <Menu.Item component={Link} to="/settings" leftSection={<IconUser size={16} />}>
                      Settings
                    </Menu.Item>
                    <Menu.Item component={Link} to={`/trader/${username}`} leftSection={<IconActivity size={16} />}>
                      Public Profile (PNL)
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </>
            ) : (
              <Group gap="xs" wrap="nowrap">
                <Button variant="default" component={Link} to="/login" size="xs" radius="xl">Login</Button>
                <Button component={Link} to="/register" size="xs" radius="xl">Sign up</Button>
              </Group>
            )}

            <ActionIcon onClick={toggleTheme} variant="subtle" radius="xl" size="lg" aria-label="Toggle theme">
              {colorScheme === 'dark' ? <IconMoon size={18} /> : <IconSun size={18} />}
            </ActionIcon>
          </Group>

          {/* Mobile Menu Trigger */}
          <Group gap={5} hiddenFrom="sm">
            <ActionIcon onClick={toggleTheme} variant="subtle" radius="xl" size="lg" aria-label="Toggle theme">
              {colorScheme === 'dark' ? <IconMoon size={18} /> : <IconSun size={18} />}
            </ActionIcon>
            {isAuthed && (
              <ActionIcon component={Link} to="/settings" variant="subtle" radius="xl" size="lg" aria-label="User settings">
                <IconUser size={18} />
              </ActionIcon>
            )}
            <Burger opened={drawerOpened} onClick={toggleDrawer} size="sm" />
          </Group>
        </Group>
      </Group>

      <Drawer opened={drawerOpened} onClose={closeDrawer} size="100%" padding="md" title="Navigation" hiddenFrom="sm" zIndex={1000000}>
        <ScrollArea h="calc(100vh - 80px)" mx="-md">
          <Divider my="sm" />
          <NavLink to="/markets" className={classes.link} onClick={closeDrawer}>Markets</NavLink>

          <Button variant="subtle" fullWidth style={{ justifyContent: 'flex-start' }} className={classes.link} onClick={toggleFutures}>Futures</Button>
          <Collapse in={futuresOpen}>
            <Stack gap={0} pl="md">
              <MobileNavItem to="/futures?quote=USDT" title="USDT-M Futures" description="Trade perpetual contracts settled in USDT" icon={<IconCurrencyDollar size={20} color="var(--mantine-color-green-6)" />} onClick={closeDrawer} />
              <MobileNavItem to="/futures?quote=USDC" title="USDC-M Futures" description="Trade perpetual contracts settled in USDC" icon={<IconCoin size={20} color="var(--mantine-color-blue-6)" />} onClick={closeDrawer} />
            </Stack>
          </Collapse>

          <Button variant="subtle" fullWidth style={{ justifyContent: 'flex-start' }} className={classes.link} onClick={toggleSpot}>Spot</Button>
          <Collapse in={spotOpen}>
            <Stack gap={0} pl="md">
              <MobileNavItem to="/spot?quote=USDT" title="USDT Market" description="Trade top tokens with USDT pairs" icon={<IconCurrencyDollar size={20} color="var(--mantine-color-green-6)" />} onClick={closeDrawer} />
              <MobileNavItem to="/spot?quote=USDC" title="USDC Market" description="Trade top tokens with USDC pairs" icon={<IconCoin size={20} color="var(--mantine-color-blue-6)" />} onClick={closeDrawer} />
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

      <Modal opened={searchOpened} onClose={closeSearch} centered withCloseButton={false} padding="lg">
        {renderSelect(undefined, true)}
      </Modal>
    </Box>
  )
}
