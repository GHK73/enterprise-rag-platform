// backend/src/middleware/upload.middleware.js

import multer from "multer";
import {validateFile} from "../utils/fileValidation.js";

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits:{
        fileSize: 25*1024*1024,
    },
    fileFilter(req,file, cb){
        try{
            validateFile(file);
            cb(null, true);
        }catch(error){
            cb(error);
        }
    },
});

export default upload;