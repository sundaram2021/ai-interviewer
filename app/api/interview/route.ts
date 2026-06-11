import { NextRequest, NextResponse } from 'next/server';
import { withSupermemory } from '@supermemory/tools/ai-sdk';
import { generateText, gateway } from 'ai';

if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_API_KEY;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const modelName = (
      process.env.REASONING_MODEL || 'deepseek/deepseek-v4-flash'
    ).replace(/['"]/g, '');
    const baseModel = gateway(modelName);
    const modelWithMemory = withSupermemory(baseModel, {
      containerTag: userId,
      customId: `interview-${userId}`,
      mode: 'profile',
    });

    const systemPrompt = `You are a professional, helpful AI voice interviewer.
Conduct a friendly but rigorous technical interview based on the user's profile and resume.

Instructions:
1. Speak clearly, concisely (max 2-3 sentences per turn), and naturally.
2. Ask one technical or behavioral question at a time.
3. React to the candidate's answer first, then ask the follow-up.
4. Avoid any text formatting like markdown asterisks, bullet points, headers, or emojis, since your output will be directly read aloud by a Text-to-Speech system.`;

    const history =
      messages && messages.length > 0
        ? messages
        : [{ role: 'user', content: 'Hi, I am ready to start my interview.' }];

    const response = await generateText({
      model: modelWithMemory,
      system: systemPrompt,
      messages: history,
    });

    return NextResponse.json({
      role: 'assistant',
      content: response.text,
    });
  } catch (error: unknown) {
    console.error('Interview route error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed in interview execution') },
      { status: 500 }
    );
  }
}
