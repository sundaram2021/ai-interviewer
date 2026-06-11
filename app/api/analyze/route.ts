import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import { scrapeGithubProfile } from '@/lib/exa-client';
import { saveUserProfile } from '@/lib/supermemory-client';
import { generateText, gateway } from 'ai';
if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_API_KEY;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const githubUrl = (formData.get('githubUrl') as string) || '';

    if (!file || !githubUrl) {
      return NextResponse.json(
        { error: 'Missing file or githubUrl' },
        { status: 400 }
      );
    }

    // Parse PDF Resume
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let resumeText = '';
    if (file.type === 'application/pdf') {
      const parser = new PDFParse({ data: fileBuffer });
      const textResult = await parser.getText();
      resumeText = textResult.text;
    } else {
      resumeText = fileBuffer.toString('utf-8');
    }

    // Scrape GitHub
    const { profileText, readmeText } = await scrapeGithubProfile(githubUrl);
    const githubUsername = githubUrl.split('/').pop() || 'candidate';

    // Analyze GitHub profile to extract most used language, activeness, etc.
    const { text: analysisText } = await generateText({
      model: gateway(
        (process.env.REASONING_MODEL || 'deepseek/deepseek-v4-flash').replace(
          /['"]/g,
          ''
        )
      ),
      prompt: `Analyze the following GitHub profile data and README to extract:
1. Most used programming language
2. Activeness level (high, medium, low)
3. Summary of contributions

Profile:
${profileText}

README:
${readmeText}

Format response as brief JSON with keys: mostUsedLanguage, activeness, summary.`,
    });

    let analysis = {
      mostUsedLanguage: 'Unknown',
      activeness: 'Medium',
      summary: '',
    };
    try {
      const jsonStart = analysisText.indexOf('{');
      const jsonEnd = analysisText.lastIndexOf('}') + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        analysis = JSON.parse(analysisText.substring(jsonStart, jsonEnd));
      }
    } catch (e) {
      console.error('Failed to parse JSON analysis response', e);
    }

    // Save user profile in Supermemory
    const userId = `user-${githubUsername.toLowerCase()}-${Date.now().toString().slice(-4)}`;
    await saveUserProfile(userId, {
      resumeText,
      githubInfo: `${profileText}\n\nREADME:\n${readmeText}\n\nSummary:\n${analysis.summary}`,
      mostUsedLanguage: analysis.mostUsedLanguage,
      githubActiveness: analysis.activeness,
    });

    return NextResponse.json({
      success: true,
      userId,
      mostUsedLanguage: analysis.mostUsedLanguage,
      activeness: analysis.activeness,
    });
  } catch (error: unknown) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to analyze') },
      { status: 500 }
    );
  }
}
