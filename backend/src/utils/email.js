// backend/src/utils/email.js

import ApiError from "./ApiError.js";


export const normalizeEmail = (email)=>{
    return email.trim().toLowerCase();
};

export const normalizeRequiredEmail = (email, fieldName="Email")=>{
    if(typeof email !== "string"){
        throw new ApiError(400,`${fieldName} is required.`);
    }

    const normalizedEmail = normalizeEmail(email);

    if(!normalizedEmail){
        throw new ApiError(400,`${fieldName} is required.`);
    }

    return normalizedEmail;
};
