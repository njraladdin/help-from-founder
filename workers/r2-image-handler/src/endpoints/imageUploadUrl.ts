import { Hono } from "hono";
import { z } from "zod";
import { Env } from "../types";
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Define the schema for the request
const ImageUploadSchema = z.object({
  fileType: z.string().refine(val => val.startsWith('image/'), {
    message: "Only image files are allowed"
  })
});

// Define the endpoint
export const ImageUploadUrl = new Hono<{ Bindings: Env }>()
  .post("", async (c) => {
    // Parse the request body
    const result = ImageUploadSchema.safeParse(await c.req.json());
    
    if (!result.success) {
      return c.json({
        success: false,
        error: result.error.message
      }, 400);
    }
    
    const { fileType } = result.data;
    
    try {
      // Generate a unique file name using UUID
      const fileExtension = fileType.split('/')[1] || 'png';
      const key = `${uuidv4()}.${fileExtension}`;
      
      console.log('Creating S3 client with account ID:', c.env.ACCOUNT_ID);
      console.log('Access key ID length:', c.env.ACCESS_KEY_ID?.length || 'undefined');
      
      // Create an S3 client for R2
      const s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${c.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: c.env.ACCESS_KEY_ID,
          secretAccessKey: c.env.SECRET_ACCESS_KEY,
        },
      });
      
      // Create a presigned URL for uploading
      const uploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({ 
          Bucket: "helpfromfounder-bucket",
          Key: key,
          ContentType: fileType
        }),
        { expiresIn: 60 * 10 } // 10 minutes
      );
      
      // Return the upload URL and key
      return c.json({
        success: true,
        uploadUrl,
        key
      });
    } catch (error) {
      console.error('Error generating upload URL:', error);
      return c.json({
        success: false,
        error: 'Failed to generate upload URL'
      }, 500);
    }
  }); 