// backend/src/middleware/upload.middleware.js

import multer from "multer";

const storage = multer.memoryStorage();

const upload = mlter({
    storage,
    limits:{
        fileSize:25*1024*1024,
    },
});

export default upload;