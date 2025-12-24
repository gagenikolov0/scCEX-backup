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




git add --all; git commit --amend; git push --force
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

