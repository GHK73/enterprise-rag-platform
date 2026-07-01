// backend/src/config/config.js

import dotenv from 'dotenv';

dotenv.config();

export default{
    app:{
        port : process.env.PORT,
        env: process.env.NODE_ENV,
    },
    database:{
        url: process.env.DATABASE_URL,
    },
    jwt:{
        secret: process.env.JWT_SECRET,
        expiresIn:process.env.JWT_EXPIRES_IN,
    },
};