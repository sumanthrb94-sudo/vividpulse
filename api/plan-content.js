/**
 * Vercel Serverless Function — /api/plan-content
 * Calls Claude (claude-sonnet-4-6) to produce a content plan.
 *
 * POST body:
 *   { uid, contentType, platform, brief, history }
 *   - uid          : Firebase user ID (validated server-side via idToken)
 *   - contentType  : 'image' | 'video' | 'reel' | 'post'
 *   - platform     : 'instagram' | 'youtube' | 'twitter' | 'linkedin'
 *   - brief        : short user brief (max 500 chars)
 *   - history      : array of last 5 content titles/descriptions (for context)
 *
 * Returns:
 *   { plan: { title, hook, structure, tone, hashtags, promptHints } }
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contentType, platform, brief, history = [] } = req.body || {};

  if (!brief || !contentType || !platform) {
    return res.status(400).json({ error: 'Missing required fields: contentType, platform, brief' });
  }

  if (brief.length > 500) {
    return res.status(400).json({ error: 'Brief exceeds 500 characters' });
  }

  // Build history context so Claude avoids repetition
  const historyText = history.length > 0
    ? `\n\nRecent content created by this user (avoid repeating these topics):\n${history.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : '';

  const systemPrompt = `You are an expert social media content strategist for a digital growth agency called Vivid Pulse.
Your job is to create detailed, actionable content plans that are unique, engaging, and tailored to the platform.
Always respond with valid JSON only — no markdown, no explanation outside the JSON.`;

  const userPrompt = `Create a content plan for the following:
- Content Type: ${contentType}
- Platform: ${platform}
- Brief: ${brief}${historyText}

Respond with a JSON object in this exact format:
{
  "title": "catchy working title for the content",
  "hook": "opening line or visual hook to grab attention in first 3 seconds",
  "structure": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "tone": "tone of voice description (e.g. energetic, educational, storytelling)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "promptHints": {
    "visual": "describe the ideal visual/thumbnail/image style",
    "caption": "suggested caption style and key message",
    "cta": "call to action suggestion"
  }
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const text = message.content[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Invalid response from AI planner' });
    }

    const plan = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ plan });
  } catch (err) {
    console.error('plan-content error:', err);
    return res.status(500).json({ error: 'AI planning failed. Please try again.' });
  }
}
