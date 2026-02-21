/**
 * Quick test script to verify Gemini video upload + query works.
 *
 * Usage:
 *   npx tsx scripts/test-gemini.ts
 *
 * Requires:
 *   - GEMINI_API_KEY in .env.local
 *   - A video file at public/highlights/game.mp4
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { GoogleGenAI, createPartFromUri } from "@google/genai";
import path from "path";

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    console.error("Set your GEMINI_API_KEY in .env.local first!");
    process.exit(1);
  }

  const videoPath = path.join(process.cwd(), "public", "highlights", "game.mp4");

  console.log("1. Initializing Gemini...");
  const ai = new GoogleGenAI({ apiKey });

  console.log("2. Uploading video:", videoPath);
  const uploadResult = await ai.files.upload({
    file: videoPath,
    config: { mimeType: "video/mp4" },
  });
  console.log("   Upload started:", uploadResult.name);

  console.log("3. Waiting for processing...");
  let file = await ai.files.get({ name: uploadResult.name! });
  while (file.state === "PROCESSING") {
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name: file.name! });
  }
  console.log("\n   State:", file.state);

  if (file.state === "FAILED") {
    console.error("Video processing failed!");
    process.exit(1);
  }

  console.log("4. Querying Gemini about the video...");
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          createPartFromUri(file.uri!, file.mimeType!),
          {
            text: "You are a sports commentator. Describe what happens in this video in 3-4 sentences. What sport is being played? What are the key moments?",
          },
        ],
      },
    ],
  });

  console.log("\n--- Gemini Response ---");
  console.log(response.text);
  console.log("--- End ---\n");

  console.log("5. Cleaning up uploaded file...");
  await ai.files.delete({ name: file.name! });
  console.log("   Done! Everything works.");
}

test().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
