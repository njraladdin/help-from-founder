import { GoogleGenerativeAI } from "@google/generative-ai";

// Get API key from environment variables
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-lite",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

interface GeneratedIssueData {
  title: string;
  tag: string;
}

// Debounce function to limit API calls
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<F extends (...args: any[]) => Promise<any>>(
  func: F,
  waitFor: number
): (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    return new Promise(resolve => {
      timeout = setTimeout(async () => {
        resolve(await func(...args));
      }, waitFor);
    });
  };
}

// Generate issue title and tag based on content
export async function generateIssueTitleAndTag(content: string): Promise<GeneratedIssueData> {
  if (!content || content.trim().length < 10) {
    return {
      title: "",
      tag: "question" // Default tag
    };
  }

  try {
    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });

    const prompt = `
Based on the following issue description, generate a concise title (max 10 words) and the most appropriate tag from this list: bug, feature, question, help, documentation.
Return ONLY the title and tag in this exact format:
TITLE: [generated title]
TAG: [tag]

Issue description:
${content}
`;

    const result = await chatSession.sendMessage(prompt);
    const response = result.response.text();
    
    // Parse the response to extract title and tag
    const titleMatch = response.match(/TITLE:\s*(.*)/i);
    const tagMatch = response.match(/TAG:\s*(.*)/i);
    
    const title = titleMatch ? titleMatch[1].trim() : "";
    let tag = tagMatch ? tagMatch[1].trim().toLowerCase() : "question";
    
    // Validate that the tag is one of the allowed values
    const validTags = ["bug", "feature", "question", "help", "documentation"];
    if (!validTags.includes(tag)) {
      tag = "question"; // Default to question if invalid tag
    }
    
    return { title, tag };
  } catch (error) {
    console.error("Error generating title and tag:", error);
    return {
      title: "",
      tag: "question" // Default tag on error
    };
  }
}

// Debounced version to prevent too many API calls
export const debouncedGenerateIssueTitleAndTag = debounce(generateIssueTitleAndTag, 2000); 