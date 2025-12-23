FUTURES TRADING RELATED
🟡 Isolated and Cross - Implementation ideas
🟡 after i close position does the profit add to my available balance? and also the total balace of course
same with the loss, does everything work perfect? you know when close we get deduction and all that ws messages






CHART RELATED
🟡 I cant see full chart, all candles
🟡 Chart overlays, since we are not using TradingView Widgets but we are fully coding our own chart





WALLET PAGE AND ASSET SELECTOR RELATED
🟡 Which css file is wallet.tsx using for its styles?
🟡 Icons for assets bro
🟡 Favorites bro. Favorites assets in market page and asset selector as separate toggle
Market page as well as the asset selector should have assets devideded in
Futures and spot and then they into 2 MORE lists - USDT and USDC lists
❓BUT if we make in USDT mode to only get info on assets that are in USDT mode 
would that implementation save a lot of energy or just a little?





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




