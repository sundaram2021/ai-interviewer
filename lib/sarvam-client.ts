const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

type SarvamTtsResponse = {
  audio?: string;
  audio_content?: string;
  audios?: string[];
  data?: {
    audio?: string;
    audio_content?: string;
    audios?: string[];
  };
};

function firstAudioFromResponse(data: SarvamTtsResponse) {
  return (
    data.audio ||
    data.audio_content ||
    data.audios?.[0] ||
    data.data?.audio ||
    data.data?.audio_content ||
    data.data?.audios?.[0] ||
    ''
  );
}

function normalizeMimeType(mimeType: string) {
  return mimeType.split(';')[0] || 'audio/webm';
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = 'audio/webm',
  filename = 'audio.webm'
) {
  if (!SARVAM_API_KEY) {
    throw new Error('Missing SARVAM_API_KEY');
  }

  const normalizedMimeType = normalizeMimeType(mimeType);
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], {
    type: normalizedMimeType,
  });
  formData.append('file', blob, filename);
  formData.append('model', 'saaras:v3');
  formData.append('mode', 'transcribe');

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sarvam STT failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.transcript || data.text || '';
}

export async function synthesizeSpeech(text: string) {
  if (!SARVAM_API_KEY) {
    throw new Error('Missing SARVAM_API_KEY');
  }

  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      target_language_code: 'en-IN',
      speaker_name: 'bulbul-v3',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sarvam TTS failed: ${response.status} - ${errText}`);
  }

  const data = (await response.json()) as SarvamTtsResponse;
  const audio = firstAudioFromResponse(data);

  if (!audio) {
    throw new Error('Sarvam TTS returned no audio content');
  }

  return audio;
}
