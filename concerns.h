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
SpotPosition.ts //❌ code style doesn't match to the rest of the models


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





WEB/
app.tsx
    Wrapped in <AuthProvider>, <AccountProvider>, and <MarketProvider> because these contexts provide global application state 
    that multiple components need access to. 


config/
api.ts
    Defined: API_BASE holds the value of the environment variables "backend url"


contexts/
AccountContext.tsx
    This is actually where the data from ws/stream/account is received in a ws message updates the states and updates the frontend UI.
    //❓But still dont know eaxctly how it updates the state like how it goes from the updated data in context to render data in spot

AuthContext.tsx 
    Authentication State Manager
    What it does:
   - Manages login/logout state (is user logged in or not?) //❓how? where?
   - Handles JWT tokens (stores, refreshes, validates) //❓ stores refreshes validates? how? where?
   - Provides login/register functions to the entire app
   - Auto-refreshes tokens every 10 minutes //❓what??? wait is it doing that with its Provider by wrapping the whole app or no?

MarketsContext.tsx
    Market Data Manager
    What it does:
    - Manages market data (tickers, stats, depth, etc.)
    - Provides market data to the entire app
    - Updates market data every 30 seconds //❓wait what really?? that sounds like polling


routes/
Auth.ts
Deposit.ts
Wallet.ts
Settings.ts
Futures.ts
Spot.ts
Markets.ts
Home.ts














❓wait wait wait why the fuck are we using emit which is ws and is supposed to be used for routes to be able
to internally send updated data to ws stream who updates the frontend UI, FOR FUCKING ORDERS???? 
IT SHOULD BE ONLY FOR POSITIONS!!!!


❓Maybe the spotTickers that gives "Last Price" ws updates shouldnt be isolated completely 
like depth, 24h change, High-Low-Volume in streams you know, because were gonna have to use it in contexts
for calculating profits....
positions
also idk how we're using "Last Price" for limit orders lol


❓What the fuck is isReady And why exactly and where are we using that in our codebase


❌ oh btw in futures you didnt really fix the 1m 5m thing it shows 1h 4h until i select the 1d or the 4k and after a second it snaps and back to only 1min and 5min


❓auth and account contexts are sending requests to user.ts route /profilel why?
REAL PURPOSE: User existence check - it's not validating the JWT token itself, it's checking if the user still exists in the database.
dude if its only checing if the user exists in the database by sending request to route that has to do with 
balances and spot positions that /profile is trying to pull from db and stuff WTFFFF


❓how do we achieve the "one socket for each account" and do we achieve that at all actually?



















# PROJECT WORKFLOWS:


Random workflow:
    1. Frontend → routes/spot.ts

    2. routes/spot.ts → MongoDB //❓via mongoose session??

    3. MongoDB → back to routes //❓via mongoose session??

    4. route → calls emitAccountEvent() that is imported from ws/account // internal connection

    5. emitAccountEvent() that is declared in ws/account → contextAccount //❓ via websocket connection? 
    // i know that we dont have this yet and that our AccountContext uses rest polling from MEXC http api, 
    // but how would make a ws connection between ws/account and AccountContext?
    // and then sends the updated data in ws message form 
    // i guess that's how it works

    6. contextAccount → spot.tsx to render it //❓internally???



❓wait do we have the same problem with markets context? 


❓also arent they supposed to be isolated??? like MarketContext cares about ws/markets and AccountContext cares about ws/account


❓show me in code exactly what should happen for emit function to be called in routes.
Im thinking transaction should be completed successfully and then emit function should be called, but im not sure...
and if im right i still dont know what exactly completing transaction means, and I gotta see in code










AuthProvider workfow:

✅ THE EXACT TECHNICAL REASON why wrapping our app in AuthProvider:
Without Provider:
Each component calls useAuth()
Each useAuth() call executes useState()
Each useState() creates a new state instance
Result: Multiple separate state instances
With Provider:
Only AuthProvider calls useState() (once)
All other components call useContext() to get the same state
