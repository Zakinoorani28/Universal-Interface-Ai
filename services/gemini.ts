import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Convert File → base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// MASTER SYSTEM PROMPT — Universal Interface AI
const SYSTEM_PROMPT = `
You are Universal Interface AI — a multimodal reasoning agent that analyzes full webpage screenshots.

Return results in this structure:

### 1. Page Summary
Short, clear explanation of the page layout and visible sections.

### 2. Action Guide (Step-by-Step)
A simple workflow describing how a user should accomplish their task.  
Keep each step short:
- action  
- location  
- why it matters  

### 3. Automation JSON
Return a clean JSON script with:
- action
- target description
- optional value

### 4. Accessibility Rewrite
Produce a simplified, screen-reader-friendly representation of the key information.

### 5. Voice Commands
Give 5–8 natural-language voice commands a disabled user could say.

STYLE RULES:
- Be concise.
- Do not generate long paragraphs.
- Do NOT guess elements not visible in the screenshot.
- Use Markdown formatting.
- Keep reasoning readable and human-oriented.
`;

export const runUniversalInterface = async ({
  website_image,
  task_prompt,
  page_url,
}: {
  website_image: File;
  task_prompt: string;
  page_url?: string;
}): Promise<string> => {
  try {
    const base64 = await fileToBase64(website_image);

    const userContent = [
      {
        inlineData: {
          mimeType: website_image.type,
          data: base64,
        },
      },
      { text: `User task: ${task_prompt}` },
      { text: `Page URL (optional): ${page_url || "none"}` },
    ];

    try {
      // Attempt with the requested High-Reasoning Model
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: userContent,
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
      });
      return response.text || "No response generated.";

    } catch (primaryError: any) {
      // Fallback to Flash if Pro is unavailable (404) or permission denied
      if (
        primaryError.message?.includes("404") || 
        primaryError.status === 404 || 
        primaryError.message?.includes("not found")
      ) {
        console.warn("Gemini 3 Pro unavailable, falling back to Gemini 2.0 Flash.");
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: userContent,
          config: {
            systemInstruction: SYSTEM_PROMPT,
          },
        });
        return response.text || "No response generated.";
      }
      throw primaryError;
    }

  } catch (err: any) {
    console.error("Universal Interface Error:", err);
    // Throwing error allows the UI to display it
    throw new Error(err.message || "Unable to process the image.");
  }
};

export const runFollowUpChat = async ({
  history,
  newMessage,
  analysisContext,
}: {
  history: { role: string; parts: { text: string }[] }[];
  newMessage: string;
  analysisContext: string;
}): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-pro-preview",
      config: {
        systemInstruction: `You are a follow-up assistant. You ONLY use the analysis result given to you as context.
Do not invent new details not present in the result.
Keep answers short, accessible, and accurate.

ANALYSIS CONTEXT:
${analysisContext}`,
      },
      history: history,
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "I couldn't generate a response.";
  } catch (err: any) {
    console.error("Chat Error:", err);
    throw new Error("Unable to process chat message.");
  }
};
