// api/generate.js
// Generates sticker images via fal.ai. API key stays server-side.
// Accepts a pre-validated description from /api/analyse.

import { withGuard, ok, fail } from "../lib/guard.js";

const STYLE_PROMPTS = {
  kawaii: (d, caption) =>
    `kawaii chibi cartoon sticker of a ${d.animal}, ${d.colors}, ${d.expression}, ${d.feature}. ` +
    `Oversized head, huge sparkling eyes, pastel colors, thick black outlines, white border outline, ` +
    `transparent background, no scene background. ` +
    `Text at the bottom reads "${caption}" in bold rounded font with white stroke outline`,

  comic: (d, caption) =>
    `bold comic book cartoon sticker of a ${d.animal}, ${d.colors}, ${d.expression}, ${d.feature}. ` +
    `Thick ink outlines, flat saturated colors, pop art style, white border outline, ` +
    `transparent background, no scene background. ` +
    `Text at the bottom reads "${caption}" in bold comic font with thick outline`,

  watercolour: (d, caption) =>
    `watercolour illustration sticker of a ${d.animal}, ${d.colors}, ${d.expression}, ${d.feature}. ` +
    `Soft painted edges, warm palette, white border outline, transparent background, no scene background. ` +
    `Text at the bottom reads "${caption}" in elegant painted lettering`,

  // Pro styles
  neon: (d, caption) =>
    `neon glow cartoon sticker of a ${d.animal}, ${d.colors}, ${d.expression}, ${d.feature}. ` +
    `Glowing neon outlines, cyberpunk vibe, white border outline, transparent background. ` +
    `Text at the bottom reads "${caption}" in glowing neon font`,

  golden: (d, caption) =>
    `golden luxury cartoon sticker of a ${d.animal}, ${d.colors}, ${d.expression}, ${d.feature}. ` +
    `Metallic gold accents, elegant outlines, white border outline, transparent background. ` +
    `Text at the bottom reads "${caption}" in elegant gold lettering`,

  minimal: (d, caption) =>
    `minimal clean line art sticker of a ${d.animal}, ${d.colors}, ${d.expression}, ${d.feature}. ` +
    `Simple shapes, limited palette, modern flat design, white border outline, transparent background. ` +
    `Text at the bottom reads "${caption}" in clean minimal font`,
};

const FREE_STYLES = ["kawaii", "comic", "watercolour"];
const PRO_STYLES  = ["neon", "golden", "minimal"];

export default withGuard("generate", async (req, res, { deviceId }) => {
  if (req.method !== "POST") return fail(res, "Method not allowed.", 405);

  const { description, styleId, caption, isPro } = req.body;

  if (!description || !styleId || !caption) {
    return fail(res, "Missing required fields.", 400);
  }

  // Block pro styles for non-pro users
  if (PRO_STYLES.includes(styleId) && !isPro) {
    return fail(res, "Pro subscription required for this style.", 403);
  }

  const promptFn = STYLE_PROMPTS[styleId];
  if (!promptFn) return fail(res, "Unknown style.", 400);

  const prompt = promptFn(description, caption);

  const response = await fetch("https://fal.run/fal-ai/sticker-maker", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Key ${process.env.FAL_API_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: "realistic, photo, blurry, background scene, landscape, multiple animals, human, watermark",
      image_size:      "square_hd",
      sync_mode:       true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("fal.ai error:", err);
    return fail(res, "Image generation failed.", 502);
  }

  const data = await response.json();
  const url  = data.images?.[0]?.url;
  if (!url) return fail(res, "No image returned.", 502);

  return ok(res, { url });
});
