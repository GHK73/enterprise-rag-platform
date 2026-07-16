// backend/src/config/ai.js

import axios from "axios";
import config from "./config.js";

const aiClient = axios.create({
    baseURL: config.ai.url,
    timeout: 5*60*1000,
    headers:{
        "Content-Type":"application/json",  
    },
});

export default aiClient;