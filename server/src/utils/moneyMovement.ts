import mongoose from "mongoose";
import SpotPosition from "../models/SpotPosition";

export async function moveMoney(
  session: mongoose.ClientSession,
  userId: string,
  asset: string,
  amount: number,
  action: 'SPEND' | 'RECEIVE' | 'RESERVE' | 'UNRESERVE'
) {
  const numAmount = Number(amount);
  if (isNaN(numAmount)) throw new Error("Invalid amount: " + amount);
  let inc: any = {};

  if (action === 'SPEND') {
    const pos = await SpotPosition.findOne({ userId, asset }).session(session);
    if (!pos || Number(pos.available) < numAmount) {
      throw new Error(`Insufficient ${asset} balance`);
    }
    inc = { available: -numAmount };
  }
  else if (action === 'RECEIVE') {
    inc = { available: numAmount };
  }
  else if (action === 'RESERVE') {
    const pos = await SpotPosition.findOne({ userId, asset }).session(session);
    if (!pos || Number(pos.available) < numAmount) {
      throw new Error(`Insufficient ${asset} balance`);
    }
    inc = { available: -numAmount, reserved: numAmount };
  }
  else if (action === 'UNRESERVE') {
    inc = { available: numAmount, reserved: -numAmount };
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

  // SNAP TO ZERO: If balance is effectively zero (scientific notation dust), clean it up
  if (updated) {
    let needsCleanup = false;
    if (updated.available > 0 && updated.available < 0.0000000001) {
      updated.available = 0;
      needsCleanup = true;
    }
    if (updated.reserved > 0 && updated.reserved < 0.0000000001) {
      updated.reserved = 0;
      needsCleanup = true;
    }
    if (needsCleanup) await updated.save({ session });
  }

  return {
    available: updated?.available?.toString() || '0',
    reserved: updated?.reserved?.toString() || '0'
  };
}
