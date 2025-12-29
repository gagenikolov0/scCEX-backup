═════════════════════════════
FUNCTIONALITY
═════════════════════════════

❓According to huge CEXs like MEXC, what should  under 'close' toggle closing with limit do?? same as setting TP/SL?


❓ Shouldn't the app refresh after token is removed when logged out, not only remove the refresh token and that's it?


🟡 Implementation: Favorite assets inside market page and asset selector as separate toggle
Should have assets divided into Futures and then optionally into 2 MORE - USDT and USDC lists
❓If we split spot and futures into USDT and USDC, would that save a lot of energy or just a bit?


❓So we call user/account every 10 seconds and we call user/account on focus.
If we are in home page or market page i dont think i should be calling user/account
Also, everytime a logged in user refreshes page the server receives HTTP???? if people keep refreshing the page the server will die...


❓ We need complete UI Refactor The mantine responsiveness is not bad but duplicate vertical
scrollbars appear


❓ When opening a position with limit order on the pair that already is in postition instead of normally wait for price to become limit price and than just add the margin, it actually only deducts the available balance and nothing happens.
When opening market position on a pair that we already have position it works well it just adds the marin instantly.

❓ When opening position on same pair that we already have position on, the amount should just add to the existing position margin change entry price and liquidation price. But if opening position on already having position with different side then just deduct the margin from available position, no change in entry and liquidation price.


❓Futures total price doesn't work well not accurate







═════════════════════════════
USER INTERFACE
═════════════════════════════

Also sometimes when chart loads it only shows the last single candle before i have to zoom out, or pull to the right to see the rest available candles, while sometimes the chart loads nicely, visible many candles not just a single candle.
❓That is fixed but now the chart kinda flickers it shows me one single candle except this time it doesn't allow me to zoom out to see other candles becase there are not other candles, after i refresh the chart is normal


❓ why so many "_" ???? i dont understand. I've seen some BTC_USDT on UI which should obviously be BTCUSDT but 
i there are way many _ in the codebase that what i've seen in the UI


❓There's a small UI problem with Asset selector. After i hover over it and the drop down opens and my mouse leaves the dropdown, within that second if i hover back on the Disappeared dropdown, it opens again.
If i hover back on the asset selector then yeah it should open again but not when i hover on the space where the dropdown used to be one second before it closes