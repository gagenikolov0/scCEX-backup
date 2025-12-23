🟡 Isolated and Cross - Implementation ideas

🟡 after i close position does the profit add to my available balance? and also the total balace of course
same with the loss, does everything work perfect? you know when close we get deduction and all that ws messages


❓Chart Overlays 
Futures: Shows Orders (dotted lines) and Positions (solid lines at entry price)
Spot: Currently only shows Orders (dotted lines)
🟡In the future we are gonna want Unrealized PNL, close position button and liquidation on chart


🟡 Margin (USDT/USDC) should be showed in futures position just like "Size"
Also in spot right next to the amount of asset we have - the calculated real time USDT/USDC value



🟡 Share PNL bro



🟡Slider for available amount in futures and spot right below input



🟡 Cant see full chart, all candles because history is limited to 200 candles....
🟡 Which css file is for wallet.tsx?
🟡 Icons for assets bro




🟡 Favorite assets inside market page and asset selector as separate toggle
Should have assets divided into Futures and then optionally into 2 MORE - USDT and USDC lists
❓If we split spot and futures into USDT and USDC, would that save a lot of energy or just a bit?




BIG PRICE
❓ws connection from bigPrice component to ticks stream that sends only subscribed updates
for selected asset opens in spot/futures page and closes when we leave spot/futures....
But what about 24% change, high, low, volume who also also receive subscribed updates? I only know
it uses the other stream Stats




❓So we call user/account every 10 seconds and we call user/account on focus.
If we are in home page or market page i dont think i should be calling user/account





🟡We need complete UI Refactor The mantine responsiveness is not bad but duplicate vertical
scrollbars appear





Centralizing WebSocket Handling
I am centralizing the WebSocket connections for the application. Currently, 
BigPrice and PriceChart
open redundant connections to the same tick streams. I will create a PriceContext that manages 
a single connection per market (Spot/Futures), handles multiple symbol subscriptions via fan-out,
and ensures every component receives the exact same data at the same time. 
This will improve performance and eliminate minor timing discrepancies between UI elements.