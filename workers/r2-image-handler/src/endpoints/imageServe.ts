import { Hono } from "hono";
import { Env } from "../types";

// Define the endpoint
export const ImageServe = new Hono<{ Bindings: Env }>()
  .get("/:key", async (c) => {
    // Get the image key from the request parameters
    const { key } = c.req.param();
    
    try {
      // Get the object from R2
      const object = await c.env.PROJECT_LOGOS.get(key);
      
      if (!object) {
        return c.json({
          success: false,
          error: 'Image not found'
        }, 404);
      }
      
      // Set the appropriate headers
      const headers = new Headers();
      headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
      headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      
      // Serve the image
      return new Response(object.body, {
        headers
      });
    } catch (error) {
      console.error('Error retrieving image:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve image'
      }, 500);
    }
  }); 