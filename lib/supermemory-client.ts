import Supermemory from 'supermemory';

if (!process.env.SUPERMEMORY_API_KEY) {
  throw new Error('Missing SUPERMEMORY_API_KEY environment variable');
}

const supermemory = new Supermemory({
  apiKey: process.env.SUPERMEMORY_API_KEY,
});

export async function saveUserProfile(
  userId: string,
  profileData: {
    resumeText: string;
    githubInfo: string;
    mostUsedLanguage?: string;
    githubActiveness?: string;
  }
) {
  const content = `
User Resume:
${profileData.resumeText}

GitHub Profile & Activity:
${profileData.githubInfo}
Most Used Language: ${profileData.mostUsedLanguage || 'Unknown'}
Contribution/Activeness Status: ${profileData.githubActiveness || 'Unknown'}
`;

  return await supermemory.add({
    content,
    containerTag: userId,
    metadata: {
      type: 'interview-profile',
      timestamp: new Date().toISOString(),
    },
  });
}

export async function getUserProfile(userId: string) {
  try {
    const profile = await supermemory.profile({ containerTag: userId });
    return profile;
  } catch (error) {
    console.error('Error retrieving user profile from Supermemory:', error);
    return null;
  }
}
