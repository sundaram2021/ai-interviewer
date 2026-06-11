import Exa from 'exa-js';

if (!process.env.EXA_API_KEY) {
  throw new Error('Missing EXA_API_KEY environment variable');
}

const exa = new Exa(process.env.EXA_API_KEY);

export async function scrapeGithubProfile(githubUrl: string) {
  try {
    const response = await exa.getContents([githubUrl], {
      text: { maxCharacters: 5000 },
    });

    const pageContent = response.results?.[0]?.text || '';

    const searchResponse = await exa.search(`${githubUrl} README`, {
      numResults: 3,
      useAutoprompt: false,
    });

    const readmeUrls = searchResponse.results.map((r) => r.url);
    let readmeContent = '';

    if (readmeUrls.length > 0) {
      const readmeData = await exa.getContents(readmeUrls, {
        text: { maxCharacters: 5000 },
      });
      readmeContent = readmeData.results.map((r) => r.text).join('\n\n');
    }

    return {
      profileText: pageContent,
      readmeText: readmeContent,
    };
  } catch (error) {
    console.error('Error scraping GitHub via Exa:', error);
    return { profileText: '', readmeText: '' };
  }
}
