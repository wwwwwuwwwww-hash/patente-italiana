
import { GoogleGenAI } from "@google/genai";

export async function getWordExplanation(word: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `你是意大利驾照考试专家。请简洁地解释单词 "${word}" 在意大利驾照考试中的具体含义、相关的交通法规或常见考点。使用中文回答，字数在100字以内。`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text || "暂无AI解释。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "获取解释失败，请稍后重试。";
  }
}
