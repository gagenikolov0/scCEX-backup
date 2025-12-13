import jwt from "jsonwebtoken";
import { getConfig } from "../config/env";

export interface JwtPayloadBase {
  sub: string; // gonna be used for user id in the future
  ver: number; // gonna be used for refresh token version in the future
}

export const signAccessToken = (payload: JwtPayloadBase): string => {
  const { jwtAccessSecret } = getConfig();
  return jwt.sign(payload, jwtAccessSecret, { expiresIn: "15m" });
};

export const signRefreshToken = (payload: JwtPayloadBase): string => {
  const { jwtRefreshSecret } = getConfig();
  return jwt.sign(payload, jwtRefreshSecret, { expiresIn: "7d" });
};

export const verifyAccessToken = (token: string): JwtPayloadBase => {
  const { jwtAccessSecret } = getConfig();
  return jwt.verify(token, jwtAccessSecret) as JwtPayloadBase;
};

export const verifyRefreshToken = (token: string): JwtPayloadBase => {
  const { jwtRefreshSecret } = getConfig();
  return jwt.verify(token, jwtRefreshSecret) as JwtPayloadBase;
};


