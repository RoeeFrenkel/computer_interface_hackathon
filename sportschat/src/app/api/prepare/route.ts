import { NextResponse } from "next/server";
import { ensureVideoUploaded } from "@/lib/gemini";

/**
 * Pre-upload video to Gemini File API when setup is ready.
 * Call this in the background when the app transitions to "ready" so the first ask is faster.
 */
export async function POST() {
  try {
    await ensureVideoUploaded();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[/api/prepare] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
