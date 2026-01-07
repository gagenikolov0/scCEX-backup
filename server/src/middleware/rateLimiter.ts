import rateLimit from 'express-rate-limit';
import { type Request, type Response } from 'express';
import { AuthRequest } from './auth';

// Helper to get user ID for rate limiting if authenticated, otherwise fallback to IP
const keyGenerator = (req: Request): string => {
    const authReq = req as AuthRequest;
    return (authReq.user?.id || req.ip || 'anonymous').toString();
};

/**
 * Auth Limiter: Protects login, registration, and password changes.
 * 5 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
    keyGenerator: (req) => req.ip || 'anonymous',
    validate: { ip: false }
});

/**
 * Profile Limiter: Limits profile updates (PFP).
 * 10 updates per 24 hours per user.
 */
export const profileLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Profile update limit reached. Please try again tomorrow.' },
    keyGenerator,
    validate: { ip: false }
});

/**
 * Finance Limiter: Limits withdrawals and transfers.
 * 50 operations per hour per user.
 */
export const financeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Financial operation limit reached. Please try again in an hour.' },
    keyGenerator,
    validate: { ip: false }
});

/**
 * Trade Limiter: Limits order placement and cancellation.
 * 10 operations per second per user.
 */
export const tradeLimiter = rateLimit({
    windowMs: 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trading rate limit exceeded. Please slow down.' },
    keyGenerator,
    validate: { ip: false }
});

/**
 * Discovery Limiter: Limits user search.
 * 20 searches per minute per user.
 */
export const discoveryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Search rate limit reached.' },
    keyGenerator,
    validate: { ip: false }
});
