// backend/src/services/auth.services.js

import prisma from "../config/prisma.js";
import {
    hashPassword,
    verifyPassword,
} from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";
import ApiError from "../utils/ApiError.js";
import {
    normalizeRequiredEmail,
} from "../utils/email.js";
import {
    recordFailedLogin,
    clearEmailLoginFailures,
} from "./authRateLimit.service.js";

export const registerUser = async ({
    fullName,
    email,
    password,
}) => {
    /*
     * Registration stores the same canonical form that
     * login looks up.
     *
     * Storing the raw input here would let
     * `User@Email.com` become an account that no
     * subsequent login can ever match, because
     * `loginUser` normalizes its input before lookup.
     */

    const normalizedEmail =
        normalizeRequiredEmail(email);

    /*
     * Compared case-insensitively so any pre-existing
     * row that was stored with uppercase characters
     * still blocks a duplicate registration before the
     * lowercase backfill migration runs.
     */

    const existingUser =
        await prisma.user.findFirst({
            where: {
                email: {
                    equals: normalizedEmail,
                    mode: "insensitive",
                },
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

    /*
     * The duplicate check above is a read, so two
     * concurrent registrations can both pass it. The
     * unique index is the real guard; map its violation
     * to the same 409 instead of letting it surface as a
     * 500.
     */

    let user;

    try {
        user = await prisma.user.create({
            data: {
                fullName,
                email: normalizedEmail,
                passwordHash,
            },
        });
    } catch (error) {
        if(error.code === "P2002"){
            throw new ApiError(
                409,
                "User already exists"
            );
        }

        throw error;
    }

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
        normalizeRequiredEmail(email);

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