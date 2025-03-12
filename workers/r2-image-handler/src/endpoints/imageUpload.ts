import { Hono } from "hono";
import { Env } from "../types";
import { v4 as uuidv4 } from 'uuid';

// Define the endpoint
export const ImageUpload = new Hono<{ Bindings: Env }>()
  .post("", async (c) => {
    try {
      // Get the file from the request
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return c.json({
          success: false,
          error: 'No file provided'
        }, 400);
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return c.json({
          success: false,
          error: 'Only image files are allowed'
        }, 400);
      }
      
      // Generate a unique file name
      const fileExtension = file.type.split('/')[1] || 'png';
      const key = `${uuidv4()}.${fileExtension}`;
      
      // Upload to R2
      const arrayBuffer = await file.arrayBuffer();
      await c.env.PROJECT_LOGOS.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type
        }
      });
      
      // Return the key
      return c.json({
        success: true,
        key
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      return c.json({
        success: false,
        error: 'Failed to upload image'
      }, 500);
    }
  }); 