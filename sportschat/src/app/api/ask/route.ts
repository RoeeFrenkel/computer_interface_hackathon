import { NextRequest, NextResponse } from "next/server";
import { askAboutGameStream } from "@/lib/gemini";
import { AskRequest } from "@/lib/types";

function sseLine(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

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

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of askAboutGameStream(question, timestamp, expertise)) {
            controller.enqueue(new TextEncoder().encode(sseLine({ text: chunk })));
          }
          controller.enqueue(new TextEncoder().encode(sseLine({ done: true })));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[/api/ask] Error:", message);
          controller.enqueue(new TextEncoder().encode(sseLine({ error: message })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
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
