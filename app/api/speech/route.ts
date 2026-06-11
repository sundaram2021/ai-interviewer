import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio, synthesizeSpeech } from '@/lib/sarvam-client';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    if (mode === 'stt') {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { error: 'Missing audio file' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const transcript = await transcribeAudio(
        buffer,
        file.type || 'audio/webm',
        file.name || 'audio.webm'
      );
      return NextResponse.json({ transcript });
    }

    if (mode === 'tts') {
      const { text } = await req.json();
      if (!text) {
        return NextResponse.json(
          { error: 'Missing text content' },
          { status: 400 }
        );
      }

      const audioBase64 = await synthesizeSpeech(text);
      return NextResponse.json({ audio: audioBase64 });
    }

    return NextResponse.json(
      { error: "Invalid mode. Use 'stt' or 'tts'." },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Speech API route error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed processing speech') },
      { status: 500 }
    );
  }
}
