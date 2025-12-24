export interface JwtPayloadBase {
    sub: string;
    ver: number;
}
export declare const signAccessToken: (payload: JwtPayloadBase) => string;
export declare const signRefreshToken: (payload: JwtPayloadBase) => string;
export declare const verifyAccessToken: (token: string) => JwtPayloadBase;
export declare const verifyRefreshToken: (token: string) => JwtPayloadBase;
//# sourceMappingURL=jwt.d.ts.map