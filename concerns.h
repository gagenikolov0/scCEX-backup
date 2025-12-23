🟡 Isolated and Cross - Implementation ideas

🟡 after i close position does the profit add to my available balance? and also the total balace of course
same with the loss, does everything work perfect? you know when close we get deduction and all that ws messages


❓Chart Overlays 
Futures: Shows Orders (dotted lines) and Positions (solid lines at entry price)
Spot: Currently only shows Orders (dotted lines)
🟡In the future we are gonna want Unrealized PNL, close position button and liquidation on chart


🟡 Margin (USDT/USDC) should be showed in futures position just like "Size"
Also in spot right next to the amount of asset we have - the calculated real time USDT/USDC value


❓So now that we implemented the Price Context how does PriceService take prices and cash them?



❓How does liquidation engine work?


❓Why does spot limit orders overlay on chart say undefined?



🟡 Share PNL bro

🟡Slider for available amount in futures and spot right below input

🟡 Icons for assets bro

🟡❓ Cant see full chart history, history limited to 200 candles

🟡❓ Which css file is for wallet.tsx?





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
























1. The "Zombie" Reserved Balance (Futures)
In your FuturesEngine (the "Pro Engine"), when a limit order is filled:

It creates the position and calculates the margin correctly.
The Issue: It never goes back to the FuturesAccount to clear the reserved margin.
Result: As a user trades, their "Reserved" balance will keep growing indefinitely in the database, even 
though the order is no longer pending. Eventually, their wallet will show they have millions "reserved" 
that dont exist.



2. The MEXC Underscore Bug (Dead Engines)
Your UI and Futures orders use symbols like BTC_USDT.

The Issue: When the FuturesEngine asks for a price, it calls priceService.getPrice("BTC_USDT")
This hits the MEXC Spot API, which does not recognize underscores. It expects BTCUSDT.
Result: The Price Service will always return an error for any symbol with an underscore. 
This means your limit orders will never fill and no one will ever be liquidated, even if the 
price crashes to zero.



3. The "Last One Wins" Balance Bug
In moveMoney.ts, the code reads the balance, calculates the new value in Javascript, and uses $set to 
update MongoDB.

The Issue: This is classic "Race Condition" territory. If two orders are placed at the same microsecond:
Order A reads balance: 100
Order B reads balance: 100
Order A subtracts 10, sets balance to 90
Order B subtracts 20, sets balance to 80 (overwriting the 90!)
Result: The user just got a $10 discount because the updates werent atomic. You should be using $inc 
directly in the MongoDB query.