// backend/src/middleware/auth.middleware.js

import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import prisma from "../config/prisma.js";
import {verifyToken} from "../utils/jwt.js";

const authenticate = asyncHandler(async(req, _, next)=>{
    const authHeader = req.headers.authorization;

    if(!authHeader?.startsWith("Bearer ")){
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
        throw new ApiError(
            401,
            "User not found"
        );
    }

    if(!user.isActive){
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

