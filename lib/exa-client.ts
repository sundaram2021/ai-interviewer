import Exa from 'exa-js';

let exaClient: Exa | null = null;

function getExa() {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error('Missing EXA_API_KEY environment variable');
  if (!exaClient) exaClient = new Exa(apiKey);
  return exaClient;
}

export interface WebSearchResult {
  title: string;
  url: string;
  text: string;
}

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const exa = getExa();
  const response = await exa.search(query, {
    numResults: 4,
    useAutoprompt: false,
    contents: { text: { maxCharacters: 1_500 } },
  });

  return response.results.map((result) => ({
    title: result.title || result.url,
    url: result.url,
    text: result.text || '',
  }));
}

export async function scrapeGithubProfile(githubUrl: string) {
  try {
    const exa = getExa();
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
