// backend/src/services/auth.services.js

import prisma from "../config/prisma.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";
import ApiError from "../utils/ApiError.js";

export const registerUser = async({fullName, email, password})=>{
    const existingUser = await prisma.user.findUnique({
        where:{email,},
    });
    if(existingUser){
        throw new ApiError(409,"User already Exists");
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
        data:{
            fullName,
            email,
            passwordHash,
        },
    });

    const token = generateToken(user);
    return {user,token,};
};


export const loginUser = async({email,password})=>{
    const user = await prisma.user.findUnique({
        where:{
            email,
        },
    });
    if(!user){
        throw new ApiError(401,"Invalid Email or Password");
    }

    const isPasswordValid = await verifyPassword(
        password,
        user.passwordHash
    );

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid Email or Password");
    }

    if(!user.isActive){
        throw new ApiError(403,"Account is inactive");
    }

    const token = generateToken(user);

    return {user,token,};
};