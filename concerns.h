Missing ideas:
🟡 Share PNL bro
🟡 Slider for available amount in futures and spot right below input
🟡 Icons for assets bro
🟡 Isolated and Cross
🟡 In the future we are gonna want Unrealized PNL, close position button and liquidation on chart




❓ after i close position does the profit add to my available balance? and also the total balace of course
same with the loss, does everything work perfect? you know when close we get deduction and all that ws messages




❓ Margin (USDT/USDC) should be showed in futures position just like "Size"
Also in spot right next to the amount of asset we have - the calculated real time USDT/USDC value




❓So now that we implemented the Price Context how does PriceService take prices and cash them?




❓ Cant see full chart history - limited to 200 candles, but 200 candles applied to all intervals/charts?




❓ Which css file is for wallet.tsx?





🟡 Favorite assets inside market page and asset selector as separate toggle
Should have assets divided into Futures and then optionally into 2 MORE - USDT and USDC lists
❓If we split spot and futures into USDT and USDC, would that save a lot of energy or just a bit?





❓So we call user/account every 10 seconds and we call user/account on focus.
If we are in home page or market page i dont think i should be calling user/account





🟡We need complete UI Refactor The mantine responsiveness is not bad but duplicate vertical
scrollbars appear





❓wait shouldnt we make everyone use price service even the PriceContext???
How is priceContext getting prices? ohh because it will be the same? wait maybe it wont
if priceService holds hot prices ready to give away instantly and for very cheap then
PriceContext wont have to listen to ws connections from the ticks stream...
Since BigPrice and Chart dont receive prices directly from ticks stream, they do from PriceContext which 
receives price from ticks stream




❓I wanna know exactly where priceService is fed by both ticks and stats at the same time and how
is that even possible









✅ 2. Futures (The "Pro" Engine)
Where: engine.ts
Clock: 2 seconds
Logic: The Engine is its own Boss. It wakes up, checks the DB, and "asks" for the price.
Why: Futures are heavy. Calculating "Unrealized PnL" and "Liquidation Ratios" for every user takes
more CPU. We run it every 2s so the server doesnt catch fire if there are thousands of positions.


The Pro Engine (Futures) never listens to the stream. It is completely deaf to the stream calls.
The only thing the stream calls is the Spot matching function.


✅The "Pro Engine" is a single class that handles both Futures Matching and Liquidation in one go


❓why calling engine every time we get new price if pro engine doesnt even listen to him lol
oh wait theres the catch, when say pro enine wakes up and as for the price thats where you mean 
he starts to listen to the calls from stream and stops ignoring him

❓Also do we have like 3 separate engines like one for limit orders in spot one for limit orders in
futures and one for liquidations in futures?















❌ There's terrible mistake in UnrealizedPNL in futures it literally shows 100 times more than it is
but then wwhen i close the position it shos correct amount.

✅fixed that "100x" PnL bug!
The Problem:
The UI was calculating PnL for all your positions using only the price of the coin currently showing in 
the chart header. So if you looked at BTC, it would think your PEPE position was suddenly worth $96,000f