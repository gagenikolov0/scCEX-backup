
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { FuturesPosition } from './models/FuturesPosition';

dotenv.config({ path: path.join(__dirname, '../.env') });

const check = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/scCEX';
        await mongoose.connect(uri);

        console.log('Checking positions...');
        const positions = await FuturesPosition.find({});

        let corruptedCount = 0;
        for (const pos of positions) {
            console.log(`Pos ${pos._id}: Symbol=${pos.symbol}, Entry=${pos.entryPrice}, Qty=${pos.quantity}`);
            if (isNaN(pos.entryPrice) || pos.entryPrice === null) {
                console.error(`!! CORRUPTED POS: ${pos._id} has NaN entryPrice`);
                corruptedCount++;
            }
        }

        console.log(`Found ${corruptedCount} corrupted positions.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

check();
