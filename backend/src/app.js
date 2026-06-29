// backend/src/app.js

import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get("/",(req,res)=>{
    res.status(200).json({
        success: true,
        message:"RAG Backend is running",
    });
});

export default app;