
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { UZBEK_PROMPT_SYSTEM } from "../constants";
import { AISuggestion, Sentiment, AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const analyzeConversation = async (transcript: string): Promise<AnalysisResult> => {
  if (!transcript.trim()) {
    return { sentiment: Sentiment.NEUTRAL, suggestions: [], strategy: null };
  }

  // Further reduce context for ultra-low latency - last 6 lines
  const context = transcript.split('\n').slice(-6).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: context }] }],
      config: {
        systemInstruction: UZBEK_PROMPT_SYSTEM,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  priority: { type: Type.STRING }
                },
                required: ['type', 'title', 'description', 'priority']
              }
            },
            strategy: {
              type: Type.OBJECT,
              properties: {
                methodName: { type: Type.STRING },
                combination: { type: Type.STRING },
                benefit: { type: Type.STRING }
              },
              required: ['methodName', 'combination', 'benefit']
            }
          },
          required: ['sentiment', 'suggestions', 'strategy']
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      sentiment: result.sentiment || Sentiment.NEUTRAL,
      suggestions: (result.suggestions || []).map((s: any, idx: number) => ({
        ...s,
        id: `ai-${Date.now()}-${idx}`
      })),
      strategy: result.strategy || null
    };
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    
    // Check for quota exceeded specifically
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes("429") || errorMessage.includes("Quota") || errorMessage.includes("exhausted")) {
      return { 
        sentiment: Sentiment.NEUTRAL, 
        suggestions: [{
          id: `quota-alert-${Date.now()}`,
          type: 'alert',
          title: 'Tizim band (Debouncer)',
          description: 'AI so\'rovlar limiti tugadi. Biroz kuting va qayta urinib ko\'ring.',
          priority: 'medium'
        }],
        strategy: null
      };
    }

    return { 
      sentiment: Sentiment.NEUTRAL, 
      suggestions: [{
        id: `error-${Date.now()}`,
        type: 'alert',
        title: 'Tahlil xatosi',
        description: 'AI suhbatni tahlil qila olmadi. Internet aloqasini tekshiring.',
        priority: 'high'
      }],
      strategy: null
    };
  }
};
