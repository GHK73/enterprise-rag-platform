// backend/src/controllers/auth.controller.js

import {registerUser,loginUser} from "../services/auth.services.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

export const register = asyncHandler(async(req,res)=>{
    const {fullName, email, password} = req.body;
    const result = await registerUser({
        fullName,
        email,
        password,
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            result,
            "User registered Succesfully"
        )
    );
});

export const login = asyncHandler(async(req,res)=>{
    const {email,password} = req.body;

    const result = await loginUser({
        email,
        password,
    });
    return res.status(200).json(
        new ApiResponse(
            200,
            result,
            "Login successsful"
        )
    );
});