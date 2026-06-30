// backend/src/middleware/authmiddleware.js

import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import prisma from "../config/prisma.js";
import {verifyToken} from "../utils/jwt.js";

const auth = asyncHandler(async(req,res, next)=>{
    const authHeader = req.headers.authorization;

    if(!authHeader|| !authHeader.startsWith("Bearer ")){
        throw new ApiError(401,"Access token is missing");
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
        where:{
            id:decoded.userId,
        },
    });

    if(!user){
        throw new ApiError(401,"User not found");
    }
    if(!user.isActive){
        throw new ApiError(403,"Account is inactive");
    }

    req.user = user;
    next();
});

export default auth;
