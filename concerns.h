# FILE CONCERNS:

SERVER/
index.ts
    Gives the names to all endpoints e.g.
    app.use("/api/auth", authRoutes)
    app.use("/api/user", userRoutes)
    app.use("/api/markets", marketsRoutes)
    app.use("/api/spot", spotRoutes)


middleware/
auth.ts
    Defined: requireAuth() - validates the access token in the request header
    Defined: AuthRequest() - extends the Request type to include the user property //❓not complely understanding


models/
AddressGroup.ts //
SpotOrders.ts //
SpotPosition.ts //❌ code style doesn't match to the rest of the models
User.ts //

routes/
auth.ts
    endpoints: 
    POST /register
    POST /login
    POST /logout
    POST /refresh

markets.ts
    endpoints: 
    GET /spot/ticker
    GET /spot/klines
    GET /spot/intervals
    GET /spot/depth
    GET /spot/stats

spot.ts
    endpoints: 
    POST /orders - Place market/limit orders
    GET /orders - List recent orders
    GET /positions - List spot positions
    DELETE /orders/:id - Cancel pending Orders

    MEXC API for spot tickers (cached) //❓what the fuck?

user.ts
    endpoints: 
    GET /profile - User profile with balances
    GET /address-group - User address group
    POST /transfer - Transfer between spot/futures

    MEXC API for spot tickers (cached) //❓what the fuck? why is user route using mexc api??

    Models that its using:
    User, SpotPosition, AddressGroup //❓wait why spotPosition??? 
    // so its communicating with  the database to ask for what positions user has...

    what it does:
    User profile management
    address groups
    fund transfers between spot/futures //❓wait what???? that shouldn't be in users route, should it?


utils/
jwt.ts
    Defined: verifyAccessToken() - verifies the access token //❓ how does it do that exactly??
    Defined: extractToken() - extracts the token from the request //❓what does that even mean?


ws/index.ts
    Defined: attachMarketWSS() - attaches the market WSS server which is a wss server that is used to 
    stream the market data to the frontend //❓what? i thought ws/streams/account is for AccountContext.tsx 
    // and idk exactly what ws stream provides for MarketContext

ws/streams/
account.ts
    Defined: stream - the stream object that holds the paths and the wss server //❓what?
    Defined: emitAccountEvent() - emits an account event to the client(s) over a WebSocket connection
    Defined: extractToken() - extracts the token from the request //❓why exactly?




WEB/
app.tsx
    Wrapped in <AuthProvider>, <AccountProvider>, and <MarketProvider> because these contexts provide global application state 
    that multiple components need access to.


contexts/
AccountContext.tsx
    Makes a regular HTTP GET request (/api/user/profile, /api/spot/orders)
    Defines refreshBalances() / refreshOrders() helper functions
    auth token appears.

    AccountContext.tsx and EmitAccountEvent function that sends ws messages to client are completely independent
    of each other.


AuthContext.tsx 
    Authentication State Manager
    What it does:
   - Manages login/logout state (is user logged in or not?) //❓how? where?
   - Handles JWT tokens (stores, refreshes, validates) //❓ stores refreshes validates? how? where?
   - Provides login/register functions to the entire app
   - Auto-refreshes tokens every 10 minutes //❓what??? wait is it doing that with its Provider by wrapping the whole app or no if yes how?

MarketsContext.tsx
    Market Data Manager
    What it does:
    - Manages market data (tickers, stats, depth, etc.)
    - Provides market data to the entire app


routes/
Auth.ts
Deposit.ts
Wallet.ts
Settings.ts
Futures.ts
Spot.ts
Markets.ts
Home.ts











❓Maybe the spotTickers that gives "Last Price" ws updates shouldnt be isolated completely 
like depth, 24h change, High-Low-Volume in streams you know, because were gonna have to use it in contexts
for calculating profits....
positions
also idk how we're using "Last Price" for limit orders lol





❓What is isReady And why exactly and where are we using that in our codebase
✅ Purpose of isReady: Prevents the "flash of login screen" when the app first loads for the authenticated users
Ensures we dont show protected content until weve verified the users auth state
Without isReady, you might briefly show the login screen to an already-authenticated user while 
the token is being verified
We are using it in AuthContext.tsx


❌ oh btw in futures you didnt really fix the 1m 5m thing it shows 1h 4h until i select the 1d or 
the 4h and after a second it snaps and back to only 1min and 5min






❓AuthContext and AccountContexts are sending requests to user.ts route /profille ....why?
✅ REAL PURPOSE: User existence check - its not validating the JWT token itself, its checking if the user 
still exists in the database.
dude if its only checing if the user exists in the database by sending request to route that has to do with 
balances and spot positions that /profile is trying to pull from db and stuff WTFFFF






❓Why wrapping the app with AuthProvider?
✅ With vs Without Provider
Without Provider:
Each component calls useAuth()
Each useAuth() call executes useState()
Each useState() creates a new state instance
Result: Multiple separate state instances
With Provider:
Only AuthProvider calls useState() (once)
All other components call useContext() to get the same state



❓Why Emit?
✅ Emit: helper to push a JSON payload from the server to the client(s) over a WebSocket connection
Without helper You have to repeat: • fetch sockets • build JSON • loop & send
The only place that calls emitAccountEvent is server/src/routes/spot.ts

#We are using it for ws updates for available balances, orders and positions❓ 

#Flow:

1. Client → Server (HTTP)
The browser calls a Spot API endpoint (e.g., POST /api/spot/orders).

2. Route handler spot.ts processes the request
Updates the database, calculates balances/positions, etc.

3. Route calls emitAccountEvent
Passes userId and an AccountEvent object (kind: 'balance' | 'position' | 'order').

4. emitAccountEvent - helper in account.ts
Looks up all open WebSocket connections for that userId, builds a JSON payload, loops over each socket
and calls ws.send(payload). 

5. WebSocket → Client
The browsers WebSocket listener receives the message, parses the JSON and updates 
the UI (balances, positions, order status).
In web/spot.tsx we have
const ws = new WebSocket(`${API_BASE.replace(/^http/, 'ws')}/ws/spot-24h`);
which listens to messages sent by Emit.

❓But Emit should actually be used for like events so when something is clicked or interacted with only then we start
getting ws messages like updates or something it doesnt make any sense to get ws messages just for updating 
available balances once







❓Whats ws/index.ts for?
✅ Imports all WebSocket stream handlers (spotTickers, futuresTickers, etc.)
1. Listens for WebSocket upgrade requests (when a client connects via WebSocket)
2. Routes connections to the correct stream based on the URL path
3. Handles upgrades from HTTP to WebSocket 

the frontend creates the WebSocket URL, but the backend's 
ws/index.ts is responsible for:

Accepting the WebSocket handshake
Routing to the correct handler based on the URL
Managing the WebSocket connection lifecycle



