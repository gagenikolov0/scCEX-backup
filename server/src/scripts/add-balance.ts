import mongoose from 'mongoose'
import { User } from '../models/User'
import { SpotPosition } from '../models/SpotPosition'
import { getConfig } from '../config/env'

async function addBalance() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2)
    if (args.length < 3) {
      console.log('Usage: npm run add-balance <email> <asset> <amount>')
      console.log('Example: npm run add-balance user@example.com USDT 1000.50')
      process.exit(1)
    }

    const [email, asset, amount] = args
    
    if (!email || !asset || !amount) {
      console.log('Error: All arguments are required')
      process.exit(1)
    }
    
    const numAmount = parseFloat(amount)
    
    if (isNaN(numAmount) || numAmount < 0) {
      console.log('Error: Amount must be a positive number')
      process.exit(1)
    }

    // Connect to MongoDB
    const config = getConfig()
    await mongoose.connect(config.mongoUri)
    console.log('Connected to MongoDB')

    // Find user by email
    const user = await User.findOne({ email }).lean()
    if (!user) {
      console.log(`User with email ${email} not found`)
      process.exit(1)
    }

    console.log(`Found user: ${user.email}`)

    // Update or create position
    const result = await SpotPosition.findOneAndUpdate(
      { userId: user._id, asset: asset.toUpperCase() },
      { 
        userId: user._id, 
        asset: asset.toUpperCase(), 
        available: amount,
        total: amount
      },
      { upsert: true, new: true }
    )

    console.log(`✅ ${asset.toUpperCase()} balance updated for ${user.email}:`)
    console.log(`   Available: ${result.available}`)
    console.log(`   Total: ${result.total}`)

    process.exit(0)
  } catch (error) {
    console.error('Failed to add balance:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  addBalance()
}
