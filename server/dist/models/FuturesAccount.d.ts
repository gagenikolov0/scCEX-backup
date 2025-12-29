import mongoose from 'mongoose';
export declare const FuturesAccount: mongoose.Model<{
    updatedAt: NativeDate;
    userId: string;
    asset: string;
    available: number;
    reserved: number;
}, {}, {}, {}, mongoose.Document<unknown, {}, {
    updatedAt: NativeDate;
    userId: string;
    asset: string;
    available: number;
    reserved: number;
}, {}, mongoose.DefaultSchemaOptions> & {
    updatedAt: NativeDate;
    userId: string;
    asset: string;
    available: number;
    reserved: number;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    updatedAt: NativeDate;
    userId: string;
    asset: string;
    available: number;
    reserved: number;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    updatedAt: NativeDate;
    userId: string;
    asset: string;
    available: number;
    reserved: number;
}>, {}, mongoose.ResolveSchemaOptions<mongoose.DefaultSchemaOptions>> & mongoose.FlatRecord<{
    updatedAt: NativeDate;
    userId: string;
    asset: string;
    available: number;
    reserved: number;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=FuturesAccount.d.ts.map