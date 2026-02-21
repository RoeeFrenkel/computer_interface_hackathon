import { GoogleGenAI, createPartFromUri } from "@google/genai";
import { ExpertiseLevel } from "./types";
import { buildPrompt } from "./prompts";
import path from "path";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

let cachedFile: { uri: string; mimeType: string } | null = null;

export async function ensureVideoUploaded(): Promise<{
  uri: string;
  mimeType: string;
}> {
  if (cachedFile) {
    console.log("[gemini] Using cached video file:", cachedFile.uri);
    return cachedFile;
  }

  const videoPath = path.join(process.cwd(), "public", "highlights", "game.mp4");

  // Check file exists and size
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found at: ${videoPath}`);
  }
  const stats = fs.statSync(videoPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
  console.log(`[gemini] Uploading video: ${videoPath} (${sizeMB} MB)`);

  const uploadResult = await ai.files.upload({
    file: videoPath,
    config: { mimeType: "video/mp4" },
  });
  console.log("[gemini] Upload started, name:", uploadResult.name, "state:", uploadResult.state);

  // Wait for processing to complete
  let file = await ai.files.get({ name: uploadResult.name! });
  let waitCount = 0;
  while (file.state === "PROCESSING") {
    waitCount++;
    console.log(`[gemini] Still processing... (${waitCount * 2}s)`);
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name: file.name! });
  }

  console.log("[gemini] Final state:", file.state, "uri:", file.uri);

  if (file.state === "FAILED") {
    throw new Error("Video file processing failed in Gemini");
  }

  cachedFile = { uri: file.uri!, mimeType: "video/mp4" };
  return cachedFile;
}

export async function askAboutGame(
  question: string,
  timestamp: number,
  expertise: ExpertiseLevel
): Promise<string> {
  console.log(`[gemini] askAboutGame: "${question}" at ${timestamp}s, level=${expertise}`);

  const videoFile = await ensureVideoUploaded();
  const systemPrompt = buildPrompt(expertise, timestamp);

  console.log("[gemini] Calling generateContent...");
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          createPartFromUri(videoFile.uri, videoFile.mimeType),
          { text: systemPrompt + "\n\nUser question: " + question },
        ],
      },
    ],
  });

  const text = response.text ?? "Sorry, I couldn't generate a response.";
  console.log("[gemini] Response:", text.substring(0, 100) + "...");
  return text;
}
