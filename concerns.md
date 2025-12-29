═════════════════════════════
FUNCTIONALITY
═════════════════════════════

❓According to huge CEXs like MEXC, what should  under 'close' toggle closing with limit do?? same as setting TP/SL?


🟡 Implementation: Favorite assets inside market page and asset selector as separate toggle
Should have assets divided into Futures and then optionally into 2 MORE - USDT and USDC lists
❓If we split spot and futures into USDT and USDC, would that save a lot of energy or just a bit?


❓So we call user/account every 10 seconds and we call user/account on focus.
If we are in home page or market page i dont think i should be calling user/account
Also, everytime a logged in user refreshes page the server receives HTTP???? if people keep refreshing the page the server will die...


❓ When opening a position with limit order on the pair that already is in postition instead of normally wait for price to become limit price and than just add the margin, it actually only deducts the available balance and nothing happens.
When opening market position on a pair that we already have position it works well it just adds the marin instantly.

❓ When opening position on same pair that we already have position on, the amount should just add to the existing position margin change entry price and liquidation price. But if opening position on already having position with different side then just deduct the margin from available position, no change in entry and liquidation price.


❓Futures total price doesn't work well not accurate







═════════════════════════════
USER INTERFACE
═════════════════════════════
