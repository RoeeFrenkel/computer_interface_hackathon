import { NextRequest, NextResponse } from "next/server";
import { askAboutGame } from "@/lib/gemini";
import { AskRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body: AskRequest = await req.json();
    const { question, timestamp, expertise } = body;

    console.log("[/api/ask] Request:", { question, timestamp, expertise });

    if (!question || timestamp === undefined || !expertise) {
      console.error("[/api/ask] Missing fields:", { question, timestamp, expertise });
      return NextResponse.json(
        { error: "Missing required fields: question, timestamp, expertise" },
        { status: 400 }
      );
    }

    const answer = await askAboutGame(question, timestamp, expertise);
    console.log("[/api/ask] Success, answer length:", answer.length);
    return NextResponse.json({ answer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[/api/ask] Error:", message);
    if (stack) console.error("[/api/ask] Stack:", stack);

    return NextResponse.json(
      { error: `Failed: ${message}` },
      { status: 500 }
    );
  }
}
