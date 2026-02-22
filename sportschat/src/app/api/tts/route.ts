import { NextRequest, NextResponse } from "next/server";

// ElevenLabs voice IDs — "Josh" is energetic and young, good for sports commentary
const VOICE_ID = "TxGEqnHWrfWFTfGW9XjX";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }

  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75,
            style: 0.3,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[tts] ElevenLabs error:", response.status, errorText);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}` },
        { status: 502 }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[tts] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
