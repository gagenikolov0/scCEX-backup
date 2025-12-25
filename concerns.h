🟡 Share PNL bro

🟡 Slider for available amount in futures and spot right below input

🟡 Icons for assets bro

🟡 Isolated and Cross

🟡 In the future we are gonna want Unrealized PNL, close position button and liquidation on chart

🟡 The asset selector should appear on hover. And you should make it when hovering thats when ws updadtes
come same one that shows everything in market page litrally everything the same just smaller UI obviously



❓According to huge CEXs like MEXC what is using toggle button and then limit means setting TP/SL?



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





❓Close button and draw button still not visible on chart




❓Realiezd pnl should be shown in position table right next to Unrealized so when person closes e.g. 50%, 
50% of unrealized should become realized just like in futures history (which is perfect btw) only it 
should also be shown in position table, simple.




###########    ENGINE -> HELPERS -> EmitAccountEvent EMITTER -> AccountContext

The Engine (Logic) calls a specific helper like 
syncFuturesPosition

That helper uses the Shared Emitter (emitAccountEvent) to actually push the data to the correct user.
So: Engine -> syncHelper -> SharedEmitter. ❓Shared emmitter is EmitAccountEvent right?

❓oh wait and account even then is connected to frontend through AccountContext?
i thought Frontend is displaying every backend update indirectly because you know every 10 minutes or 
on focus frontend calls user/account and updates the context because user.ts pulls everything from db
exactly where engine updates because engine works with db only.

❓Wait does user.ts have anything to do with AccountContext and engine and stuff and if not how are they 
separated but also interfiering with each other?

































****************
WORKFLOW - You are supposed to explain isolated workflows with its isolated participants
for example... futuresEngine has nothing to do with user.ts or even less with  market.ts.. so basically 
futuresEngine is part of a one workflow with isolated participants like AccountContext, emmiters, emit helpers,
ticks stream and user.ts  would be completely in another workflow together with some other participants
Maybe user.ts is a shared participant

market.ts and MarketContext are definitely isolated participants together with stats stream they form third workflow

now of course we have shared participants so we are gonna call them shared participants 
for example authContext i believe is used everywhere as well as the tick stream being used in both charts
and big price and execute price and PriceService and what not


All participants should be mention and tagged as shared participants or isolated participants
****************
