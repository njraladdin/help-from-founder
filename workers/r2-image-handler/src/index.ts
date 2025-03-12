import { Hono } from "hono";
import { cors } from 'hono/cors';
import { ImageUploadUrl } from "./endpoints/imageUploadUrl";
import { ImageUpload } from "./endpoints/imageUpload";
import { ImageServe } from "./endpoints/imageServe";
import { Env } from "./types";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', async (c, next) => {
	const allowedOrigins = c.env.ALLOWED_ORIGINS.split(',');
	const origin = c.req.header('Origin');
	
	if (origin && allowedOrigins.includes(origin)) {
		return cors({
			origin,
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization'],
			exposeHeaders: ['Content-Length'],
			maxAge: 86400,
		})(c, next);
	}
	
	return next();
});

// Register image endpoints
app.route("/api/images/upload-url", ImageUploadUrl);
app.route("/api/images/upload", ImageUpload);
app.route("/api/images", ImageServe);

// Export the Hono app
export default app;
