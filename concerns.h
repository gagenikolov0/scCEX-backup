Missing ideas:
🟡 Share PNL bro
🟡 Slider for available amount in futures and spot right below input
🟡 Icons for assets bro
🟡 Isolated and Cross
🟡 In the future we are gonna want Unrealized PNL, close position button and liquidation on chart
🟡 The asset selector should appear on hover. And you should make it when hovering thats when ws updadtes
come same one that shows everything in market page litrally everything the same just smaller UI obviously



❓According to huge CEXs like MEXC what is using toggle button and then limit means setting TP/SL?




🟡TP and SL bro on the positions with partial closing And they should be overlays on the chart too!!




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





❓In backend futures engine if im not mistaken, we have each function doing its own DB session
Isnt that a lot of DB sessions instead of just one and getting things done faster? or wait,
maybe that practice is not clean






❓btw does each function also call each emmitter?
or each function calls the shared emmitter?
either way does each function call emmiter or one function for all function calls emmiter?

✅ It runs cleaner than that.
The Engine (Logic) calls a specific helper like 
syncFuturesPosition

That helper uses the Shared Emitter (emitAccountEvent) to actually push the data to the correct user.
So: Engine -> syncHelper -> SharedEmitter.

❓oh wait and account even then is connected to frontend through AccountContext?
i thought Frontend is displaying every backend update indirectly because you know every 10 minutes or 
on focus frontend calls user/account and updates the context because user.ts pulls everything from db
exactly where engine updates because engine works with db only.






❓So wait in MoneyMove which is in backend there still is tp/sl calculation there except its not live 
every tick its just once so basically backend does tp/sl calculation as well

✅ YES. This is critical.
Live Tick (Every 2 seconds): The backend checks every single position against the current price.
If Price hits TP, the Backend executes the trade.
The Frontend checks are visual only (to capture your attention). 
The Backend check is the one that actually moves the money.
❓okay then if im perfectly right then, i wanna see exactly where the pnl logic is specifically for tp/sl









❓ what the hell do we need scripts in backend for isnt that completely useless?