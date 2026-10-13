// backend/src/middleware/auth.middleware.js

import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import prisma from "../config/prisma.js";
import {verifyToken} from "../utils/jwt.js";
import {
    createAuthSecurityEvent,
    recordAuthSecurityEvent,
} from "../services/metrics/metrics.service.js";

const authenticate = asyncHandler(async(req, _, next)=>{
    const authHeader = req.headers.authorization;

    if(!authHeader?.startsWith("Bearer ")){
        recordAuthSecurityEvent(createAuthSecurityEvent({
            eventType: "JWT_INVALID",
            outcome: "UNAUTHORIZED",
            reasonCode: "MISSING_TOKEN",
            ip: req.ip,
        }));
        throw new ApiError(
            401,
            "Access token is missing"
        );
    }

    const token = authHeader.slice(7);

    let decoded;

    try{
        decoded = verifyToken(token);
    }
    catch{
        recordAuthSecurityEvent(createAuthSecurityEvent({
            eventType: "JWT_INVALID",
            outcome: "UNAUTHORIZED",
            reasonCode: "INVALID_OR_EXPIRED",
            ip: req.ip,
        }));
        throw new ApiError(
            401,
            "Invalid or expired token"
        );
    }

    const user = await prisma.user.findUnique({
        where:{
            id:decoded.userId
        },
        include:{
            unit:true
        }
    });

    if(!user){
        recordAuthSecurityEvent(createAuthSecurityEvent({
            eventType: "JWT_INVALID",
            outcome: "UNAUTHORIZED",
            reasonCode: "USER_NOT_FOUND",
            ip: req.ip,
        }));
        throw new ApiError(
            401,
            "User not found"
        );
    }

    if(!user.isActive){
        recordAuthSecurityEvent(createAuthSecurityEvent({
            eventType: "ACCOUNT_INACTIVE",
            outcome: "FORBIDDEN",
            reasonCode: "ACCOUNT_INACTIVE",
            userId: user.id,
            organizationId: user.unit?.organizationId || null,
            ip: req.ip,
        }));
        throw new ApiError(
            403,
            "Account is inactive"
        );
    }

    const {passwordHash, ...safeUser} = user;

    req.user = safeUser;

    next();
});

export default authenticate;

