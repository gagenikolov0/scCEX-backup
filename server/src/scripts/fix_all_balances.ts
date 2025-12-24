
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/exchange';

async function run() {
    console.log('Connecting to MongoDB at', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    try {
        // 1. Fix FuturesAccounts
        const futuresCollection = mongoose.connection.collection('futuresaccounts');
        const futuresCursor = futuresCollection.find({});
        let futuresFixed = 0;

        console.log('Scanning FuturesAccounts...');
        while (await futuresCursor.hasNext()) {
            const doc = await futuresCursor.next();
            if (!doc) continue;

            let needsUpdate = false;
            const update: any = {};

            if (typeof doc.available === 'string') {
                console.log(`[FuturesAccount] Found string available for user ${doc.userId} asset ${doc.asset}: "${doc.available}"`);
                let val = parseFloat(doc.available);
                if (isNaN(val)) val = 0;
                update.available = val;
                needsUpdate = true;
            }

            if (typeof doc.reserved === 'string') {
                console.log(`[FuturesAccount] Found string reserved for user ${doc.userId} asset ${doc.asset}: "${doc.reserved}"`);
                let val = parseFloat(doc.reserved);
                if (isNaN(val)) val = 0;
                update.reserved = val;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await futuresCollection.updateOne({ _id: doc._id }, { $set: update });
                console.log(`[FuturesAccount] Fixed document ${doc._id}`);
                futuresFixed++;
            }
        }
        console.log(`FuturesAccounts scan done. Fixed ${futuresFixed} documents.`);

        // 2. Fix SpotPositions (Re-run just in case)
        const spotCollection = mongoose.connection.collection('spotpositions');
        const spotCursor = spotCollection.find({});
        let spotFixed = 0;

        console.log('Scanning SpotPositions...');
        while (await spotCursor.hasNext()) {
            const doc = await spotCursor.next();
            if (!doc) continue;

            let needsUpdate = false;
            const update: any = {};

            if (typeof doc.available === 'string') {
                console.log(`[SpotPosition] Found string available for user ${doc.userId} asset ${doc.asset}: "${doc.available}"`);
                let val = parseFloat(doc.available);
                if (isNaN(val)) val = 0;
                update.available = val;
                needsUpdate = true;
            }

            if (typeof doc.reserved === 'string') {
                console.log(`[SpotPosition] Found string reserved for user ${doc.userId} asset ${doc.asset}: "${doc.reserved}"`);
                let val = parseFloat(doc.reserved);
                if (isNaN(val)) val = 0;
                update.reserved = val;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await spotCollection.updateOne({ _id: doc._id }, { $set: update });
                console.log(`[SpotPosition] Fixed document ${doc._id}`);
                spotFixed++;
            }
        }
        console.log(`SpotPositions scan done. Fixed ${spotFixed} documents.`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

run();
