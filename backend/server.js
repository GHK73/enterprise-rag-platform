// backend/server.js

import app from './src/app.js';
import config from './src/config/config.js';
import prisma from './src/config/prisma.js';

const startServer = async()=>{
    try{
        await prisma.$connect();
        console.log("Connected to Neon Database");

        app.listen(config.app.port,()=>{
            console.log(
                `Server is running on http://localhost:${config.app.port}`
            );
        });
    }catch(error){
        console.error("Failed to connect to database");
        console.error(error);
        process.exit(1);
    }
};

startServer();