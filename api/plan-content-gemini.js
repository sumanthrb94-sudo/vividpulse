/**
 * Vercel Serverless Function — /api/plan-content-gemini
 * Calls Gemini (gemini-2.0-flash-exp) to produce a content plan.
 * Used when strategy = "google" or "gemini-only"
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

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

  const historyText = history.length > 0
    ? `\n\nRecent content (avoid repeating):\n${history.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : '';

  const systemInstruction = `You are an expert social media content strategist for Vivid Pulse, a digital growth agency.
Create detailed, actionable content plans tailored to the platform. Always respond with valid JSON only — no markdown outside JSON.`;

  const prompt = `Create a content plan:
- Content Type: ${contentType}
- Platform: ${platform}
- Brief: ${brief}${historyText}

Respond with JSON in this exact format:
{
  "title": "catchy working title",
  "hook": "opening line or visual hook to grab attention in first 3 seconds",
  "structure": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "tone": "tone description (e.g. energetic, educational, storytelling)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "promptHints": {
    "visual": "ideal visual/thumbnail/image style",
    "caption": "suggested caption style and key message",
    "cta": "call to action suggestion"
  }
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Invalid response from Gemini planner' });
    }

    const plan = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ plan });
  } catch (err) {
    console.error('plan-content-gemini error:', err);
    return res.status(500).json({ error: 'Gemini planning failed. Please try again.' });
  }
}
