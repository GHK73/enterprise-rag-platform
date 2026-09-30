// backend/src/services/auth.services.js

import prisma from "../config/prisma.js";
import {
    hashPassword,
    verifyPassword,
} from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";
import ApiError from "../utils/ApiError.js";
import {
    recordFailedLogin,
    clearEmailLoginFailures,
} from "./authRateLimit.service.js";

export const registerUser = async ({
    fullName,
    email,
    password,
}) => {
    const existingUser = await prisma.user.findUnique({
        where: {
            email,
        },
    });

    if (existingUser) {
        throw new ApiError(
            409,
            "User already exists"
        );
    }

    const passwordHash = await hashPassword(
        password
    );

    const user = await prisma.user.create({
        data: {
            fullName,
            email,
            passwordHash,
        },
    });

    const token = generateToken(user);

    const {
        passwordHash: _,
        ...safeUser
    } = user;

    return {
        user: safeUser,
        token,
    };
};

export const loginUser = async ({
    email,
    password,
    ip,
}) => {
    /*
     * Normalize the email once so the same account cannot
     * bypass the email-based limit using different casing.
     *
     * Example:
     *
     * User@Email.com
     * user@email.com
     * USER@EMAIL.COM
     *
     * all map to the same account key.
     */

    const normalizedEmail =
        email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
        where: {
            email: normalizedEmail,
        },
    });

    /*
     * Do not reveal whether the account exists.
     */

    if (!user) {
        await recordFailedLogin({
            email: normalizedEmail,
            ip,
        });

        throw new ApiError(
            401,
            "Invalid email or password"
        );
    }

    const isPasswordValid =
        await verifyPassword(
            password,
            user.passwordHash
        );

    if (!isPasswordValid) {
        await recordFailedLogin({
            email: normalizedEmail,
            ip,
        });

        throw new ApiError(
            401,
            "Invalid email or password"
        );
    }

    /*
     * The credentials are correct, but the account is
     * inactive.
     *
     * This is not treated as a failed password attempt.
     */

    if (!user.isActive) {
        throw new ApiError(
            403,
            "Account is inactive"
        );
    }

    /*
     * Successful authentication.
     *
     * Clear the failed-login counter for this email so
     * legitimate users do not remain penalized after
     * successfully authenticating.
     *
     * We intentionally do NOT clear the IP counter because
     * the same IP may be attacking multiple accounts.
     */

    await clearEmailLoginFailures(
        normalizedEmail
    );

    const token = generateToken(user);

    const {
        passwordHash: _,
        ...safeUser
    } = user;

    return {
        user: safeUser,
        token,
    };
};