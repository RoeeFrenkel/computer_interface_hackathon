import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.join(process.cwd(), "public", "highlights");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "game.mp4");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const bytes = await file.arrayBuffer();
    fs.writeFileSync(OUTPUT_FILE, Buffer.from(bytes));

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);

    return NextResponse.json({
      success: true,
      message: `Uploaded ${sizeMB} MB`,
      path: "/highlights/game.mp4",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Upload failed", details: message },
      { status: 500 }
    );
  }
}
