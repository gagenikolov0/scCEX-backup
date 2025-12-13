import mongoose from "mongoose";
import { SpotOrder } from "../models/SpotOrder";
import SpotPosition from "../models/SpotPosition";

export async function moveMoney(
  session: mongoose.ClientSession,
  userId: string,
  asset: string,
  amount: number,
  action: 'SPEND' | 'RECEIVE' | 'RESERVE' | 'UNRESERVE'
) {
  const pos = await SpotPosition.findOne({ userId, asset }).session(session);
  const avail = parseFloat(pos?.available?.toString() || "0");
  const reserved = parseFloat(pos?.reserved?.toString() || "0");

  let newAvail = avail;
  let newReserved = reserved;

  if (action === 'SPEND') {
    if (avail < amount) throw new Error(`Insufficient ${asset} balance`);
    newAvail = avail - amount;
  }
  else if (action === 'RECEIVE') {
    newAvail = avail + amount;
  }
  else if (action === 'RESERVE') {
    if (avail < amount) throw new Error(`Insufficient ${asset} balance`);
    newAvail = avail - amount;
    newReserved = reserved + amount;
  }
  else if (action === 'UNRESERVE') {
    newAvail = avail + amount;
    newReserved = reserved - amount;
  }

  await SpotPosition.updateOne(
    { userId, asset },
    {
      $set: {
        available: newAvail.toFixed(8),
        reserved: newReserved.toFixed(8),
        updatedAt: new Date()
      }
    },
    { session, upsert: true }
  );

  return { available: newAvail.toFixed(8), reserved: newReserved.toFixed(8) };
}
