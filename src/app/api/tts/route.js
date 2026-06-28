import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const { text, lang, voice } = await req.json();
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: "음성으로 변환할 텍스트(text)가 누락되었습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API Key가 누락되었습니다. 환경설정을 확인해 주세요." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize the Gemini API client
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Choose gemini-2.5-flash as the multimodal audio generation model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    console.log(`[TTS API] Generating audio for text: "${text.substring(0, 30)}..." using voice: ${voice || "Puck"}`);

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice || "Puck" // Puck, Charon, Kore, Fenrir, Aoede
            }
          }
        }
      }
    });

    const candidate = result.response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (!part || !part.inlineData || !part.inlineData.data) {
      console.error("[TTS API] Invalid Gemini response candidates:", JSON.stringify(result.response));
      throw new Error("Gemini 모델이 오디오 데이터를 반환하지 않았습니다.");
    }

    const base64Data = part.inlineData.data;
    const mimeType = part.inlineData.mimeType || "audio/wav";
    const audioBuffer = Buffer.from(base64Data, "base64");

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error) {
    console.error("[TTS API] Error generating audio:", error);
    return new Response(
      JSON.stringify({ error: error.message || "음성 합성 중 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
