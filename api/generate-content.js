/**
 * Vercel Serverless Function — /api/generate-content
 * Calls Gemini (gemini-2.0-flash-exp or gemini-1.5-pro) to generate final content.
 *
 * POST body:
 *   { contentType, platform, plan, editedPrompts }
 *   - contentType   : 'image' | 'video' | 'reel' | 'post'
 *   - platform      : 'instagram' | 'youtube' | 'twitter' | 'linkedin'
 *   - plan          : the plan object from step 1 (may have been edited)
 *   - editedPrompts : { visualPrompt, captionPrompt, ctaPrompt } — user-edited hints from step 2
 *
 * Returns:
 *   { result: { script, caption, hashtags, imagePrompt, notes } }
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contentType, platform, plan, editedPrompts = {} } = req.body || {};

  if (!contentType || !platform || !plan) {
    return res.status(400).json({ error: 'Missing required fields: contentType, platform, plan' });
  }

  const isVideo = contentType === 'video' || contentType === 'reel';

  const systemInstruction = `You are a professional content creator and copywriter for Vivid Pulse, a digital growth agency.
You produce platform-native, high-converting content. Always respond with valid JSON only.`;

  const prompt = `Generate complete, publish-ready content based on this approved plan:

Content Type: ${contentType}
Platform: ${platform}

APPROVED PLAN:
Title: ${plan.title}
Hook: ${plan.hook}
Structure: ${(plan.structure || []).join(' | ')}
Tone: ${plan.tone}
Hashtags: ${(plan.hashtags || []).join(' ')}

USER-EDITED DIRECTIONS:
Visual direction: ${editedPrompts.visualPrompt || plan.promptHints?.visual || 'Follow the plan'}
Caption direction: ${editedPrompts.captionPrompt || plan.promptHints?.caption || 'Follow the plan'}
CTA: ${editedPrompts.ctaPrompt || plan.promptHints?.cta || 'Follow the plan'}

Generate the final content as JSON in this exact format:
{
  ${isVideo ? `"script": "Full narration/video script with scene descriptions in [brackets], dialogue, and timing cues",` : ''}
  "caption": "Full ${platform} caption with line breaks, emojis where appropriate, and the CTA",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"],
  "imagePrompt": "Detailed Midjourney/DALL-E style prompt for the visual (thumbnail or main image)",
  "notes": "Any additional tips for shooting, editing, or posting this content"
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Invalid response from AI generator' });
    }

    const generated = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ result: generated });
  } catch (err) {
    console.error('generate-content error:', err);
    return res.status(500).json({ error: 'Content generation failed. Please try again.' });
  }
}
