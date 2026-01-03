
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { FuturesOrder } from './models/FuturesOrder';
import { FuturesPosition } from './models/FuturesPosition';

// Explicitly point to .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const clean = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/scCEX';
        console.log('Connecting to Mongo at:', uri.replace(/:([^:@]{1,})@/, ':****@'));

        await mongoose.connect(uri);
        console.log('Connected.');

        // 1. Clean Orders
        const resOrders = await FuturesOrder.deleteMany({
            $or: [
                { price: 0, type: 'limit' },
                { price: { $exists: false }, type: 'limit' },
                { status: 'pending', price: 0 }
            ]
        });
        console.log(`Deleted ${resOrders.deletedCount} invalid orders`);

        // 2. Clean FuturesPositions with NaN entryPrice
        const positions = await FuturesPosition.find({});
        let posDeleted = 0;
        for (const pos of positions) {
            if (isNaN(pos.entryPrice) || pos.entryPrice === null) {
                console.log(`Deleting corrupted position: ${pos._id} (entryPrice: ${pos.entryPrice})`);
                await FuturesPosition.deleteOne({ _id: pos._id });
                posDeleted++;
            }
        }
        console.log(`Deleted ${posDeleted} corrupted positions`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

clean();
