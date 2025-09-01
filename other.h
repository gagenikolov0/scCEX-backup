# PROJECT STRUCTURE
/server
    config = Configuration files (DB, environment variables, settings)
    controllers = Handle request logic and responses
    helper = 
    middleware = 
    models = Store data
    routes = Routes Should Handle (HTTP Layer)
    websockets = Send live updates (like a PA system announcing updates)

    services-missing = Business Logic

/web 
    components = Reusable parts (buttons, charts, forms)
    config = 
    context = mechanism for sharing values (like state, functions, theme, user info)... A way to pass data down the component tree without having to prop-drill
    lib =
    markets = 
    routes = Different screens



# PROJECT ARCHITECTURE
/server

# config/env.ts


# middleware/auth.ts


# models/AddressGroup.ts
# SpotOrder.ts
# SpotPosition.ts
# User.ts


# routes/auth.ts

# routes/markets.ts

# routes/spot.ts
    POST /orders - Place market/limit orders
    GET /orders - List recent orders
    GET /positions - List spot positions
    DELETE /orders/:id - Cancel pending orders

# routes/user.ts
    GET /profile - User profile with balances
    GET /address-group - User address group
    POST /transfer - Transfer between spot/futures



# utils/jwt.ts


# ws/account.ts 
    Responsible for:
    1. Balance Updates
    2. Position Updates
    3. Order Updates

    Exactly when its triggered:    Emit function in routes triggers it by calling the function there  
        Trigger 1: After Order Execution (Market Orders)
        Location: routes/spot.ts - Lines 207, 219, 226
        When: After a market order is successfully executed
        What it sends:
        - Balance update
        - Position update
        - Order confirmation - Order details with "filled" status

        Trigger 2: After Order Cancellation
        Location: routes/spot.ts - Order cancellation section
        When: After a pending order is cancelled
        What it sends: Balance update - Reserved funds returned to available balance

    What ws/account Provides:
    ✅ WebSocket Server Management - Handles connections, authentication, user mapping
    ✅ Event Emission Infrastructure - emitAccountEvent() function
    ✅ User Socket Management - Maps users to their WebSocket connections
    ✅ Authentication - JWT token verification for WebSocket connections
    ✅ Event Types - Already defined: balance, position, order





/web


# Spot.tsx
    Available Balance Validator is in routes/spot.ts (Backend Routes)
    server/src/routes/spot.ts - Lines 71, 89, 121, 156



    the whole spot page is rendered there all of it. and theres onclick function to buy 






# AccountContext.tsx
    Stores and manages frontend state related to the user, 
    including balances, positions, and orders, andprovides  this data to any component that needs it ❓which fucking component would need it?

    What it does:
    - Stores and manages user balances (USDT, USDC amounts)
    - Manages trading positions (BTC, ETH holdings)
    - Tracks user orders (buy/sell orders, status) ❓
    - Calculates portfolio value in USD⚠️ //should be isolated from context
    - Refreshes data every 30 seconds⚠️ //what???


AuthContext.tsx 
    Authentication State Manager
    What it does:
        Manages login/logout state (is user logged in or not?)
        Handles JWT tokens (stores, refreshes, validates)
        Provides login/register functions to the entire app
        Auto-refreshes tokens every 10 minutes


# api.ts


# portfolioCalculator.ts

# useIntervalls.ts
    I guess wasted ❓

# utils.ts


# markets/







❓ wait wait wait why the fuck are we using emit which is ws and is supposed to be used for routes to be able
to internally send updated data to ws stream who updates the frontend UI, FOR FUCKING ORDERS???? 
IT SHOULD BE ONLY FOR POSITIONS!!!!





❓Maybe the spotTickers that gives "Last Price" ws updates shouldnt be isolated completely 
like depth, 24h change, High-Low-Volume in streams you know, because were gonna have to use it in contexts
for calculating profits....
positions
also idk how we're using "Last Price" for limit orders lol



❓why are you putting ws/account in streams together with these depth, 24h change, High-Low-Volume



❓What the fuck is isReady And why exactly and where are we using that in our codebase



❓i think somwhere in the codebase we have 30 second polling and it had to do somethin with unauthenticated users... I know it sounds weird but I saw it somewhere I dont remember



❓Be honest, you isolated portfolio tracker from trading logic but didnt isolate it from something else, and that is ? Show me everywhere that we are using code regarding portfolio tracker.🚨



❓Difference between controllers and routes. And how are we using them?
Let me guess, we're doing the work of controllers all in routes?






# Complete Difference Analysis: user.ts vs spot.ts

user.ts: User profile management, address groups, and ❓fund transfers between spot/futures❓
spot.ts: Spot trading operations (orders, positions, market execution)

1. Routes endpoints
user.ts
GET /profile
GET /address-group
POST /transfer
spot.ts
POST /orders
GET /orders
GET /positions
DELETE /orders/:id

2. Models they use
user.ts
- User, SpotPosition, AddressGroup ❓wait why spotPosition???
spot.ts
- User, SpotOrder, SpotPosition

3. External API Dependencies ❓ i gotta check this!!
user.ts
MEXC API for spot tickers (cached)
spot.ts
MEXC API for real-time price fetching

4. WebSocket Integration in the routes
user.ts
No WebSocket events
spot.ts
Emits account events via emitAccountEvent for orders, balances, and positions





spotTicks.ts
    - Every time the price changes, thats a tick
    Price goes up → Tick sent
    Price goes down → Tick sent

spotStats.ts
    ✅ 24h percentage change (priceChangePercent)
    ✅ 24h high price (highPrice)
    ✅ 24h low price (lowPrice)
    ✅ 24h volume (volume + quoteVolume)

spotDepth.ts
    - Orderbook

spotTicker.ts
    - Last Price


❓I think we should have single stats depth thicks and ticker for both futures and spot unless thee are some 
for futures that are unavailable for spot and vise versa








# Trading Workflow:
    1. Frontend → routes/spot.ts (http ovviously)
    2. routes/spot.ts → MongoDB (via session)
    3. MongoDB → back to routes (via session)
    4. route → calls emitAccountEvent() that is imported from ws/account
    5. emitAccountEvent() declared in ws/account updates frontend UI in spot.tsx //i guess that's how it works


    ❓show me exactly in our code how and where ws/account receives data after we call the emit function in routes.
    like is the data getting received in the function?
    and show me in code exactly what should happen for emit function to be called in routes

    ❓wait how exactly? what exactly happens after message is recieved? how is the frontend UI gettng refreshed?
