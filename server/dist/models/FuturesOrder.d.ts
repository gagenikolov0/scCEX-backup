import mongoose from 'mongoose';
export declare const FuturesOrder: mongoose.Model<{
    symbol: string;
    createdAt: NativeDate;
    type: "limit" | "market";
    userId: string;
    side: "long" | "short";
    quantity: number;
    leverage: number;
    margin: number;
    status: "filled" | "rejected" | "pending" | "cancelled";
    marginMode: "isolated" | "cross";
    executedQuantity: number;
    averagePrice: number;
    price?: number | null;
}, {}, {}, {}, mongoose.Document<unknown, {}, {
    symbol: string;
    createdAt: NativeDate;
    type: "limit" | "market";
    userId: string;
    side: "long" | "short";
    quantity: number;
    leverage: number;
    margin: number;
    status: "filled" | "rejected" | "pending" | "cancelled";
    marginMode: "isolated" | "cross";
    executedQuantity: number;
    averagePrice: number;
    price?: number | null;
}, {}, mongoose.DefaultSchemaOptions> & {
    symbol: string;
    createdAt: NativeDate;
    type: "limit" | "market";
    userId: string;
    side: "long" | "short";
    quantity: number;
    leverage: number;
    margin: number;
    status: "filled" | "rejected" | "pending" | "cancelled";
    marginMode: "isolated" | "cross";
    executedQuantity: number;
    averagePrice: number;
    price?: number | null;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    symbol: string;
    createdAt: NativeDate;
    type: "limit" | "market";
    userId: string;
    side: "long" | "short";
    quantity: number;
    leverage: number;
    margin: number;
    status: "filled" | "rejected" | "pending" | "cancelled";
    marginMode: "isolated" | "cross";
    executedQuantity: number;
    averagePrice: number;
    price?: number | null;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    symbol: string;
    createdAt: NativeDate;
    type: "limit" | "market";
    userId: string;
    side: "long" | "short";
    quantity: number;
    leverage: number;
    margin: number;
    status: "filled" | "rejected" | "pending" | "cancelled";
    marginMode: "isolated" | "cross";
    executedQuantity: number;
    averagePrice: number;
    price?: number | null;
}>, {}, mongoose.ResolveSchemaOptions<mongoose.DefaultSchemaOptions>> & mongoose.FlatRecord<{
    symbol: string;
    createdAt: NativeDate;
    type: "limit" | "market";
    userId: string;
    side: "long" | "short";
    quantity: number;
    leverage: number;
    margin: number;
    status: "filled" | "rejected" | "pending" | "cancelled";
    marginMode: "isolated" | "cross";
    executedQuantity: number;
    averagePrice: number;
    price?: number | null;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=FuturesOrder.d.ts.map