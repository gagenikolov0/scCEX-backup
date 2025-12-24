import mongoose from "mongoose";
export declare function moveMoney(session: mongoose.ClientSession, userId: string, asset: string, amount: number, action: 'SPEND' | 'RECEIVE' | 'RESERVE' | 'UNRESERVE'): Promise<{
    available: string;
    reserved: string;
}>;
//# sourceMappingURL=moneyMovement.d.ts.map