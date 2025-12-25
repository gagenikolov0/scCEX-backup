🟡 Share PNL bro

🟡 Slider for available amount in futures and spot right below input

🟡 Icons for assets bro

🟡 Isolated and Cross

🟡 In the future we are gonna want Unrealized PNL, close position button and liquidation on chart

🟡 The asset selector should appear on hover. And you should make it when hovering thats when ws updadtes
come same one that shows everything in market page litrally everything the same just smaller UI obviously



❓According to huge CEXs like MEXC what is using toggle button and then limit means setting TP/SL?



❓ Cant see full chart history - limited to 200 candles, but 200 candles applied to all intervals/charts?



❓ Which css file is for wallet.tsx?




🟡 Favorite assets inside market page and asset selector as separate toggle
Should have assets divided into Futures and then optionally into 2 MORE - USDT and USDC lists
❓If we split spot and futures into USDT and USDC, would that save a lot of energy or just a bit?





❌So we call user/account every 10 seconds and we call user/account on focus.
If we are in home page or market page i dont think i should be calling user/account





❌We need complete UI Refactor The mantine responsiveness is not bad but duplicate vertical
scrollbars appear





❓wait shouldnt we make everyone use price service even the PriceContext???
How is priceContext getting prices? ohh because it will be the same? wait maybe it wont
if priceService holds hot prices ready to give away instantly and for very cheap then
PriceContext wont have to listen to ws connections from the ticks stream...
Since BigPrice and Chart dont receive prices directly from ticks stream, they do from PriceContext which 
receives price from ticks stream




❓I wanna know exactly where priceService is fed by both ticks and stats at the same time and how
is that even possible





❓There's draw mode in PriceChart but not visible in the app????





❓Close button and draw button still not visible on chart




❓Realiezd pnl should be shown in position table right next to Unrealized so when person closes e.g. 50%, 
50% of unrealized should become realized just like in futures history (which is perfect btw) only it 
should also be shown in position table, simple.




###########    ENGINE -> HELPERS -> EmitAccountEvent EMITTER -> AccountContext

The Engine (Logic) calls a specific helper like 
syncFuturesPosition

That helper uses the Shared Emitter (emitAccountEvent) to actually push the data to the correct user.
So: Engine -> syncHelper -> SharedEmitter. ❓Shared emmitter is EmitAccountEvent right?

❓oh wait and account even then is connected to frontend through AccountContext?
i thought Frontend is displaying every backend update indirectly because you know every 10 minutes or 
on focus frontend calls user/account and updates the context because user.ts pulls everything from db
exactly where engine updates because engine works with db only.

❓Wait does user.ts have anything to do with AccountContext and engine and stuff and if not how are they 
separated but also interfiering with each other?

































****************
WORKFLOWS - How Components Work Together
****************

═══════════════════════════════════════════════════════════════════════════════
WORKFLOW 1: FUTURES TRADING
═══════════════════════════════════════════════════════════════════════════════

THE FLOW:
1. User clicks "Buy Long" in Futures.tsx
2. Futures.tsx calls POST /api/futures/orders from futures.ts
3. futures.ts (POST /api/futures/orders handler) calls openPosition() from futuresEngine.ts
4. openPosition() writes to:
   - FuturesPosition DB (creates/updates position record)
   - FuturesAccount DB (deducts margin from available balance)
5. openPosition() calls syncFuturesPosition() from emitters.ts
6. syncFuturesPosition() calls emitAccountEvent() from account.ts
7. emitAccountEvent() sends WebSocket message to ws.onmessage from AccountContext.tsx
8. ws.onmessage receives the message, parses JSON, calls setState() to update AccountContext state
9. setState() triggers React to re-render all components that use AccountContext (Futures.tsx, Spot.tsx, etc.)

BACKGROUND TICK LOOP:
- Every 2 seconds, tick() from futuresEngine.ts runs automatically
- processTPSL() from futuresEngine.ts → getPrice() from priceService.ts to check triggers
- processLiquidations() from futuresEngine.ts → getPrice() from priceService.ts to check margin
- If triggered: executePositionClose() from futuresEngine.ts (same flow as step 4-9)

KEY INTERACTIONS:
- processTPSL() from futuresEngine.ts → getPrice() from priceService.ts: "what's BTC price?"
- openPosition() from futuresEngine.ts → moveMoney() from moneyMovement.ts: "move $100 from available to margin"
- syncFuturesPosition() from emitters.ts → emitAccountEvent() from account.ts: "tell user 123 their position changed"
- ws/streams/account.ts WebSocket → onmessage handler in AccountContext.tsx: pushes updates


═══════════════════════════════════════════════════════════════════════════════
WORKFLOW 2: SPOT TRADING
═══════════════════════════════════════════════════════════════════════════════

THE FLOW:
1. User places Limit Order in Spot.tsx
2. Spot.tsx calls POST /api/spot/orders
3. spot.ts (POST /api/spot/orders handler) calls moveMoney() from moneyMovement.ts to reserve balance
4. spot.ts writes to SpotOrder DB (creates pending order)
5. spot.ts calls syncSpotPosition() from emitters.ts
6. syncSpotPosition() calls emitAccountEvent() from account.ts
7. emitAccountEvent() sends WebSocket message to onmessage handler in AccountContext.tsx
8. onmessage handler in AccountContext.tsx parses message and updates state
9. AccountContext.tsx updates state, Spot.tsx re-renders

BACKGROUND PRICE MATCHING:
- ws/streams/spotTicks.ts broadcasts new price every second
- spotEngine.matchLimitOrders(symbol, price) runs when price changes
- Checks SpotOrder DB for fillable orders
- If fillable: spotEngine calls moneyMovement.moveMoney() to execute trade (same flow as step 3-9)

KEY INTERACTIONS:
- matchLimitOrders() from spotEngine.ts → getPrice() from priceService.ts: "what's ETH price?"
- spot.ts → moveMoney() from moneyMovement.ts with action='RESERVE': "reserve $50 USDT"
- matchLimitOrders() from spotEngine.ts → moveMoney() from moneyMovement.ts with action='UNRESERVE': "unreserve + execute trade"
- syncSpotPosition() from emitters.ts → emitAccountEvent() from account.ts: "tell user 123 their BTC balance changed"


═══════════════════════════════════════════════════════════════════════════════
WORKFLOW 3: MARKET DATA
═══════════════════════════════════════════════════════════════════════════════

THE FLOW:
1. stats.calculateStats() runs every 5 seconds (background job in stats.ts)
2. stats.calculateStats() calls priceService.getPrice() for all pairs
3. stats.calculateStats() calculates 24h change, volume, etc.
4. stats.calculateStats() calls ws/streams/stats.ts broadcast() function
5. ws/streams/stats.ts broadcasts to MarketContext.tsx WebSocket listener
6. MarketContext.tsx updates state, Markets.tsx re-renders

KEY INTERACTIONS:
- stats.calculateStats() → priceService.getPrice(symbol): "give me all prices for all pairs"
- ws/streams/stats.ts WebSocket → MarketContext.onmessage: broadcasts to everyone


═══════════════════════════════════════════════════════════════════════════════
SHARED PARTICIPANTS - How They Connect Workflows
═══════════════════════════════════════════════════════════════════════════════

priceService.getPrice() (BACKEND - utils/priceService.ts):
  - futuresEngine.processTPSL() → priceService.getPrice(symbol)
  - spotEngine.matchLimitOrders() → priceService.getPrice(symbol)
  - stats.calculateStats() → priceService.getPrice(symbol)
  - WHY SHARED: Prevents 3 separate Binance API calls, uses 1 cache

emitAccountEvent() (BACKEND - ws/streams/account.ts):
  - syncFuturesPosition() (emitters.ts) → emitAccountEvent(userId, data)
  - syncSpotPosition() (emitters.ts) → emitAccountEvent(userId, data)
  - syncOrder() (emitters.ts) → emitAccountEvent(userId, data)
  - WHY SHARED: Single function that knows how to send WebSocket messages

ws/streams/account.ts WebSocket (BACKEND):
  - emitAccountEvent() → ws/streams/account.ts: passes message to send
  - ws/streams/account.ts → Users WebSocket connection: broadcasts to specific user
  - WHY SHARED: One WebSocket connection per user for all account updates

moneyMovement.moveMoney() (BACKEND - utils/moneyMovement.ts):
  - routes/spot.ts → moneyMovement.moveMoney(session, userId, asset, amount, action)
  - routes/futures.ts → moneyMovement.moveMoney(session, userId, asset, amount, action)
  - futuresEngine.executePositionClose() → moneyMovement.moveMoney(...)
  - WHY SHARED: Atomic DB transactions, prevents race conditions

AccountContext.tsx (FRONTEND - contexts/AccountContext.tsx):
  - ws/streams/account.ts → AccountContext.onmessage handler: pushes updates via WebSocket
  - Futures.tsx ← AccountContext.futuresPositions state: reads positions
  - Spot.tsx ← AccountContext.positions state: reads balances
  - WHY SHARED: Single source of truth for users money and positions

PriceContext.tsx (FRONTEND - contexts/PriceContext.tsx):
  - ws/streams/spotTicks.ts → PriceContext.onmessage handler: pushes price updates
  - ws/streams/futuresTicks.ts → PriceContext.onmessage handler: pushes price updates
  - PriceChart.tsx ← PriceContext.usePrice(market, symbol) hook: reads prices to draw candles
  - BigPrice.tsx ← PriceContext.usePrice(market, symbol) hook: reads prices to display
  - WHY SHARED: Single source of truth for current prices

AuthContext.tsx (FRONTEND - contexts/AuthContext.tsx):
  - All pages ← AuthContext.accessToken state: read login state
  - WHY SHARED: Login state needs to be global


═══════════════════════════════════════════════════════════════════════════════
HOW WORKFLOWS INTERACT WITH EACH OTHER
═══════════════════════════════════════════════════════════════════════════════

1. FUTURES + SPOT SHARE NOTHING (Except Shared Participants)
   - They have separate DB tables (FuturesAccount vs SpotPosition)
   - They have separate engines (futuresEngine.ts vs spotEngine.ts)
   - They have separate API routes (routes/futures.ts vs routes/spot.ts)
   - ONLY connection: Both → emitAccountEvent() → both update AccountContext

2. TRANSFER BRIDGES THE TWO WORKFLOWS
   - User clicks "Transfer" in Futures.tsx or Spot.tsx
   - TransferModal.tsx → routes/transfer.ts: POST /api/transfer
   - routes/transfer.ts → moneyMovement.moveMoney() TWICE:
     * Subtract from SpotPosition DB
     * Add to FuturesAccount DB
   - routes/transfer.ts → syncSpotPosition() + syncFuturesBalances() (both from emitters.ts)
   - Both helpers → emitAccountEvent() → AccountContext updates both wallets

3. MARKET DATA IS COMPLETELY ISOLATED
   - stats.calculateStats() doesnt call futuresEngine or spotEngine functions
   - stats.calculateStats() → priceService.getPrice() only
   - stats → MarketContext via WebSocket
   - Futures.tsx ← MarketContext.futuresStats state: reads 24h stats
   - Spot.tsx ← MarketContext.spotStats state: reads 24h stats
   - But stats.calculateStats() never writes to FuturesPosition or SpotPosition

4. PRICE SERVICE CONNECTS ALL THREE
   - futuresEngine.processTPSL() → priceService.getPrice('BTC_USDT')
   - spotEngine.matchLimitOrders() → priceService.getPrice('ETH_USDT')
   - stats.calculateStats() → priceService.getPrice(allSymbols)
   - priceService.getPrice() ↔ Binance API: fetches once, caches, serves to all three

5. USER.TS IS OUTSIDE ALL WORKFLOWS
   - Futures.tsx → GET /api/user/profile on page load: gets initial balances
   - Spot.tsx → GET /api/user/profile on page load: gets initial balances
   - routes/user.ts → DB.find(): reads and returns JSON (no engine/emitter calls)
   - After page load: AccountContext (WebSocket) handles all updates
****************
