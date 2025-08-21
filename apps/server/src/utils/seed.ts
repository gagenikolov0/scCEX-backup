import mongoose from 'mongoose'
import { getConfig } from '../config/env'
import { DepositAddress } from '../models/DepositAddress'

async function main() {
  const cfg = getConfig()
  await mongoose.connect(cfg.mongoUri)
  const existing = await DepositAddress.countDocuments({})
  if (existing > 0) {
    console.log('Keys already seeded:', existing)
    await mongoose.disconnect()
    return
  }
  const demo: Array<{address:string, asset:'USDT'|'USDC', chain:string}> = []
  for (let i = 0; i < 50; i++) {
    demo.push({ address: `USDT-DEMO-${i.toString().padStart(3,'0')}`, asset: 'USDT', chain: 'TRON' })
    demo.push({ address: `USDC-DEMO-${i.toString().padStart(3,'0')}`, asset: 'USDC', chain: 'ETH' })
  }
  await DepositAddress.insertMany(demo)
  console.log('Seeded deposit addresses:', demo.length)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


