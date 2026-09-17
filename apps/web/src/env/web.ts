import { z } from "zod";

const webEnvSchema = z.object({
	// Node
	NODE_ENV: z.enum(["development", "production", "test"]),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),

	// Public
	NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
	NEXT_PUBLIC_MARBLE_API_URL: z
		.url()
		.default("https://api.marblecms.com"),

	// Server — required for auth/db
	DATABASE_URL: z.string().refine(
		(url) =>
			url.startsWith("postgres://") || url.startsWith("postgresql://"),
		"DATABASE_URL must be a postgres:// or postgresql:// URL",
	),

	BETTER_AUTH_SECRET: z.string().min(16),

	// Optional integrations — placeholders so production boot is not blocked
	UPSTASH_REDIS_REST_URL: z.url().default("http://127.0.0.1:8079"),
	UPSTASH_REDIS_REST_TOKEN: z.string().default("local-dev-token"),
	MARBLE_WORKSPACE_KEY: z.string().default("unused"),
	FREESOUND_CLIENT_ID: z.string().default("unused"),
	FREESOUND_API_KEY: z.string().default("unused"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = webEnvSchema.parse(process.env);
