import { auth } from "@/auth/server";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

function unavailable() {
	return NextResponse.json(
		{
			error:
				"Auth is disabled until DATABASE_URL is configured. Editor projects still save in the browser.",
		},
		{ status: 503 },
	);
}

const handlers = auth ? toNextJsHandler(auth) : null;

export const GET = handlers?.GET ?? unavailable;
export const POST = handlers?.POST ?? unavailable;
