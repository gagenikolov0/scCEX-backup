FUTURES TRADING LOGIC RELATED
🟡 Isolated and Cross - Implementation ideas
🟡 after i close position does the profit add to my available balance? and also the total balace of course
same with the loss, does everything work perfect? you know when close we get deduction and all that ws messages
🟡 Chart overlays, since we are not using TradingView Widgets but we are fully coding our own chart




UI RELATED
🟡 I cant see full chart, all candles
🟡 Which css file is for wallet.tsx?
🟡 Icons for assets bro




PRICE, WALLET PAGE, ASSET SELECTOR, HEADER RELATED
🟡 Favorites assets inside market page and asset selector as separate toggle
Should have assets divided into Futures and then optionally into 2 MORE - USDT and USDC lists
❓If we split spot and futures into USDT and USDC, would that save a lot of energy or just a bit?


BIG PRICE
❓ws connection from bigPrice component to ticks stream that sends only subscribed updates
for selected asset opens in spot/futures page and closes when we leave spot/futures....
But what about 24% change, high, low, volume who also also receive subscribed updates? I only know
it uses the other stream Stats

❓When I leave the app in the background e.g. I go to Spotify and I come back to browser I see 
BigPrice not showing the color of the latest 1min candle, I literally see green last 1min candle 
while the text of  BigPrice is red and when I refresh, BigPrice goes back to showing the correct 
color like before leaving my app in the background


❓why we have price difference in BigPrice and chart price if they using the same stream they 
should be 100% identical. Is it maybe because of 2 separate ws connections to same stream?




✅ Market HTTP Route (/api/markets/...):
Job: Fetching "History" and "Snapshots" 
e.g., "Give me the last 200 candles so I can draw the chart" and 
"What was the price when this minute started?"
Used by:
PriceChart.tsx: L138: To load the candles when you first open the page (you cant get 200 candles from a ws tick stream).
BigPrice.tsx L36-L68: When it first "wakes up," it pings this route once to see what the Start Price of the current minute was.









✅ Theory on price usage stream and source
1. Header = Stats Only (5 second)
2. Chart = Ticks Only (1 second)
3. Execution = Saved into RAM whichever was latest from Stats + Ticks
4. Market.tsx = Stats (5 second)
5. Asset Selector = Startup Snapshot just for names, no price
6. Orderbook = Ticks (1 second)








The "Linking" Challenge
Since the header is updating locally, but the asset selector search list comes from the global 
MarketContext
, we have a mismatch:

Header: Living, breathing real-time data for one asset.
Asset Selector: Currently just a static list of names (The Snapshot).
If you want the Asset Selector to show live prices (and change colors): We would need to call 
listen()
 when the Search menu is opened. This would tell 
MarketContext
 to start the Bulk stream temporarily, so all prices in your search list start moving!










❓So we call user/account every 10 seconds and we call user/account on focus.
If we are in home page or market page i dont think i should be calling user/account




