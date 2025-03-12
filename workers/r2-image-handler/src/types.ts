export interface Env {
	// Bindings for R2 storage
	PROJECT_LOGOS: R2Bucket;
	
	// Environment variables
	ALLOWED_ORIGINS: string;
	
	// R2 credentials for presigned URLs
	ACCOUNT_ID: string;
	ACCESS_KEY_ID: string;
	SECRET_ACCESS_KEY: string;
}

export interface UploadResponse {
	success: boolean;
	uploadUrl?: string;
	key?: string;
	error?: string;
}

export interface ImageResponse {
	success: boolean;
	url?: string;
	error?: string;
}
