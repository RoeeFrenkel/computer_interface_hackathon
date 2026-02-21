import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

const OUTPUT_DIR = path.join(process.cwd(), "public", "highlights");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "game.mp4");

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    }

    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Remove existing file if present
    if (fs.existsSync(OUTPUT_FILE)) {
      fs.unlinkSync(OUTPUT_FILE);
    }

    // Download with yt-dlp, convert to mp4
    const command = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${OUTPUT_FILE}" "${url}"`;

    const { stdout, stderr } = await execAsync(command, { timeout: 300000 });

    if (!fs.existsSync(OUTPUT_FILE)) {
      return NextResponse.json(
        { error: "Download failed", details: stderr },
        { status: 500 }
      );
    }

    const stats = fs.statSync(OUTPUT_FILE);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

    return NextResponse.json({
      success: true,
      message: `Downloaded ${sizeMB} MB`,
      path: "/highlights/game.mp4",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // If yt-dlp needs cookies, suggest the fallback
    if (message.includes("Sign in") || message.includes("bot")) {
      return NextResponse.json(
        {
          error: "YouTube requires authentication. Try downloading the video manually and uploading it instead.",
          needsManualUpload: true,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Download failed", details: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  const exists = fs.existsSync(OUTPUT_FILE);
  if (!exists) {
    return NextResponse.json({ loaded: false });
  }
  const stats = fs.statSync(OUTPUT_FILE);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
  return NextResponse.json({ loaded: true, sizeMB });
}
