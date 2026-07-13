// backend/src/services/s3.service.js

import{
    PutObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";

import s3Client from "../config/s3.js";
import config from "../config/config.js";

export const uploadFileToS3 = async(file,objectKey)=>{
    const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
    await s3Client.send(
        new PutObjectCommand({
            Bucket: config.aws.bucket,
            Key: objectKey,
            Body: file.buffer, 
            ContentType: file.mimetype, 
        })
    );
    return {
        bucket: config.aws.bucket,
        key: objectKey,
        checksum,
    };
};

export const deleteFileFromS3 = async(objectKey)=>{
    await s3Client.send(
        new DeleteObjectCommand({
            Bucket: config.aws.bucket,
            Key: objectKey, 
        })
    );
};