import mongoose from "mongoose";
import SpotPosition from "../models/SpotPosition";

export async function moveMoney(
  session: mongoose.ClientSession,
  userId: string,
  asset: string,
  amount: number,
  action: 'SPEND' | 'RECEIVE' | 'RESERVE' | 'UNRESERVE'
) {
  let inc: any = {};

  if (action === 'SPEND') {
    // We check balance FIRST before spending to avoid negatives
    const pos = await SpotPosition.findOne({ userId, asset }).session(session);
    if (!pos || parseFloat(pos.available.toString()) < amount) {
      throw new Error(`Insufficient ${asset} balance`);
    }
    inc = { available: -amount };
  }
  else if (action === 'RECEIVE') {
    inc = { available: amount };
  }
  else if (action === 'RESERVE') {
    const pos = await SpotPosition.findOne({ userId, asset }).session(session);
    if (!pos || parseFloat(pos.available.toString()) < amount) {
      throw new Error(`Insufficient ${asset} balance`);
    }
    inc = { available: -amount, reserved: amount };
  }
  else if (action === 'UNRESERVE') {
    inc = { available: amount, reserved: -amount };
  }

  /**
   * ISSUE 3 FIX: Atomic Balance Updates.
   * TRIGGER: Called whenever money moves (Order Placement, Fill, or Cancel).
   * RATIONALE: We use MongoDB's $inc operator to ensure that multiple concurrent trades
   * (e.g. 2 orders hitting at the exact same microsecond) do not overwrite each other's 
   * balance changes. This is the only way to guarantee the balance is 100% accurate.
   */
  const updated = await SpotPosition.findOneAndUpdate(
    { userId, asset },
    { $inc: inc, $set: { updatedAt: new Date() } },
    { session, upsert: true, new: true }
  );

  return {
    available: updated?.available?.toString() || '0',
    reserved: updated?.reserved?.toString() || '0'
  };
}
