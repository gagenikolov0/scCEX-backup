import mongoose from 'mongoose';
export declare const FuturesPosition: mongoose.Model<{
    symbol: string;
    updatedAt: NativeDate;
    userId: string;
    side: "long" | "short";
    entryPrice: number;
    quantity: number;
    leverage: number;
    margin: number;
    tpPrice: number;
    tpQuantity: number;
    slPrice: number;
    slQuantity: number;
    liquidationPrice?: number | null;
}, {}, {}, {}, mongoose.Document<unknown, {}, {
    symbol: string;
    updatedAt: NativeDate;
    userId: string;
    side: "long" | "short";
    entryPrice: number;
    quantity: number;
    leverage: number;
    margin: number;
    tpPrice: number;
    tpQuantity: number;
    slPrice: number;
    slQuantity: number;
    liquidationPrice?: number | null;
}, {}, mongoose.DefaultSchemaOptions> & {
    symbol: string;
    updatedAt: NativeDate;
    userId: string;
    side: "long" | "short";
    entryPrice: number;
    quantity: number;
    leverage: number;
    margin: number;
    tpPrice: number;
    tpQuantity: number;
    slPrice: number;
    slQuantity: number;
    liquidationPrice?: number | null;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    symbol: string;
    updatedAt: NativeDate;
    userId: string;
    side: "long" | "short";
    entryPrice: number;
    quantity: number;
    leverage: number;
    margin: number;
    tpPrice: number;
    tpQuantity: number;
    slPrice: number;
    slQuantity: number;
    liquidationPrice?: number | null;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    symbol: string;
    updatedAt: NativeDate;
    userId: string;
    side: "long" | "short";
    entryPrice: number;
    quantity: number;
    leverage: number;
    margin: number;
    tpPrice: number;
    tpQuantity: number;
    slPrice: number;
    slQuantity: number;
    liquidationPrice?: number | null;
}>, {}, mongoose.ResolveSchemaOptions<mongoose.DefaultSchemaOptions>> & mongoose.FlatRecord<{
    symbol: string;
    updatedAt: NativeDate;
    userId: string;
    side: "long" | "short";
    entryPrice: number;
    quantity: number;
    leverage: number;
    margin: number;
    tpPrice: number;
    tpQuantity: number;
    slPrice: number;
    slQuantity: number;
    liquidationPrice?: number | null;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=FuturesPosition.d.ts.map