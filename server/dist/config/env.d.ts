export interface AppConfig {
    nodeEnv: "development" | "production" | "test" | string;
    port: number;
    mongoUri: string;
    jwtAccessSecret: string;
    jwtRefreshSecret: string;
    corsOrigin: string;
}
export declare const getConfig: () => AppConfig;
//# sourceMappingURL=env.d.ts.map