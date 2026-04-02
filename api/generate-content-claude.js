/**
 * Vercel Serverless Function — /api/generate-content-claude
 * Calls Claude (claude-sonnet-4-6) to generate final content.
 * Used when strategy = "claude" (Claude Only mode)
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contentType, platform, plan, editedPrompts = {} } = req.body || {};

  if (!contentType || !platform || !plan) {
    return res.status(400).json({ error: 'Missing required fields: contentType, platform, plan' });
  }

  const isVideo = contentType === 'video' || contentType === 'reel';

  const systemPrompt = `You are a professional content creator and copywriter for Vivid Pulse, a digital growth agency.
You produce platform-native, high-converting content. Always respond with valid JSON only — no markdown outside the JSON.`;

  const userPrompt = `Generate complete, publish-ready content based on this approved plan:

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
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0]?.text || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Invalid response from Claude generator' });
    }

    const generated = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ result: generated });
  } catch (err) {
    console.error('generate-content-claude error:', err);
    return res.status(500).json({ error: 'Claude content generation failed. Please try again.' });
  }
}
