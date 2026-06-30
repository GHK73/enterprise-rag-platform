// backend/src/utils.jwt.js

import jwt from "jsonwebtoken";
import config from "../config/config.js";

export const generateToken = (user)=>{
    return jwt.sign(
        {
            userId: user.id,
            role:user.role,
            unitId:user.unitId,
        },
        config.jwt.accessSecret,
        {
            expiresIn: config.jwt.accessExpiry,
        }
    );
};

export const verifyToken = (token)=>{
    return jwt.verify(token,config.jwt.secret);
};