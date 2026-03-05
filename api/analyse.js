// api/analyse.js
// Analyses a pet photo using Claude. API key stays server-side.
// Content guard: rejects images that don't contain an animal.

import { withGuard, ok, fail } from "../lib/guard.js";
import { spendCredit, getCredits } from "../lib/credits.js";

export default withGuard("analyse", async (req, res, { deviceId }) => {
  if (req.method !== "POST") return fail(res, "Method not allowed.", 405);

  const { image, mimeType } = req.body;
  if (!image || !mimeType) return fail(res, "Missing image data.", 400);

  // Validate mime type
  const allowed = ["image/jpeg","image/png","image/webp","image/gif"];
  if (!allowed.includes(mimeType)) return fail(res, "Unsupported image type.", 400);

  // Check credits before calling AI
  const { total, isPro } = await getCredits(deviceId);
  if (!isPro && total <= 0) {
    return fail(res, "No credits remaining.", 402);
  }

  // ── Call Claude ──────────────────────────────────────────────────────────────
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key":    process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: image }},
          { type: "text",  text: `Analyse this image. First check: is there a clearly visible animal (pet) in this photo?

If NO animal is present, return ONLY: {"error": "no_animal"}

If YES, return ONLY valid JSON — no markdown, no explanation:
{
  "animal":     "specific breed/type e.g. tabby cat, golden retriever",
  "colors":     "2-3 main colors e.g. orange and white, silver grey",
  "expression": "personality in 1-2 words e.g. sleepy, grumpy, regal",
  "feature":    "one distinctive feature e.g. floppy ears, fluffy tail",
  "phrases":    ["short funny caption from pet POV, max 28 chars", "second option", "third option"]
}
Captions: punchy, funny, personality-driven. No hashtags. Emojis fine.` }
        ]
      }]
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Anthropic error:", err);
    return fail(res, "AI service error.", 502);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.replace(/```json|```/g, "").trim();

  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return fail(res, "Failed to parse AI response.", 502); }

  // Content guard — reject non-animal images
  if (parsed.error === "no_animal") {
    return fail(res, "We couldn't find a pet in that photo. Please use a clear photo of your animal!", 422);
  }

  // Spend credit now that we've confirmed it's a valid pet
  const spend = await spendCredit(deviceId);
  if (!spend.success) return fail(res, spend.reason, 402);

  return ok(res, { description: parsed });
});
