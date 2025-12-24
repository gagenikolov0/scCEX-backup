Missing ideas:
🟡 Share PNL bro
🟡 Slider for available amount in futures and spot right below input
🟡 Icons for assets bro
🟡 Isolated and Cross
🟡 In the future we are gonna want Unrealized PNL, close position button and liquidation on chart


🟡Partial closing bro. When i close position i get deduction and all that ws messages fast and power saving.
when we click on the close button in position we should get a small popup asking to enter amount 
"position available" and give us slider which if we pull all the way to right input shows all 
position available from position as if we typed the position available amount which is the margin btw....
And minimum closeable should be 0.1% of position available/margin.

Also we should have a toggle in futures, just like spot that we have buy/sell, except in futures - open/close
basically when we togle on close thats where we get input for how much we want to close from the position available/margin
with the text shoing position available and lastly single close button 
available = Margin

Same slider should be in spot too, why not.



🟡TP and SL bro on the positions with partial closing And they should be overlays on thge chart too!!


🟡 Margin (USDT/USDC) should be showed in futures position just like "Size". Margin is literally the one that used to be available balance
Also in spot right next to the amount of asset we have - the calculated real time USDT/USDC value





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


















