import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const { text, lang } = await req.json();
    if (!text || !lang) {
      return new Response(
        JSON.stringify({ error: "필수 파라미터(text, lang)가 누락되었습니다." }),
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

    const genAI = new GoogleGenerativeAI(apiKey);
    // Leverage native structured JSON mode to guarantee perfect parsing
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const langNameMap = {
      "ko": "Korean (한국어)",
      "ja": "Japanese (日本語)",
      "en": "English",
      "es": "Spanish (Español)",
      "vi": "Vietnamese (Tiếng Việt)",
      "zh": "Chinese (中文)",
      "fr": "French (Français)",
      "de": "German (Deutsch)"
    };
    const targetLangName = langNameMap[lang] || lang;

    const prompt = `You are a professional linguistic analyzer and dictionary.
Analyze the following sentence in "${targetLangName}":
"${text}"

Extract 3 to 5 key vocabulary words, essential idioms, or practical phrases that are highly useful for learning "${targetLangName}".
Provide your analysis strictly as a JSON array matching this schema:
[
  { "word": "...", "reading": "...", "meaning": "..." }
]
- word: The word or phrase exactly as it appears or in its base dictionary form in "${targetLangName}".
- reading:
  - If the language is Japanese: Provide the Hiragana reading followed by the Korean phonetic pronunciation in brackets, e.g. "ぶじに [부지니]" for "無事に".
  - If the language is Chinese: Provide the Pinyin, e.g. "huānyíng" for "欢迎".
  - If the language is English: Provide the phonetic spelling or Korean reading in brackets, e.g. "[웰컴]" for "welcome".
  - For others: Provide a helpful native pronunciation guide/spelling.
- meaning: The definition of the word in Korean.

Output ONLY the raw JSON array.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    let jsonArray = [];
    try {
      jsonArray = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse Gemini vocabulary response as JSON:", responseText);
      const match = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        jsonArray = JSON.parse(match[0]);
      } else {
        throw new Error("Gemini 응답을 JSON 배열로 구문 분석할 수 없습니다.");
      }
    }

    return new Response(JSON.stringify({ vocab: jsonArray }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Vocab Analysis API Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "단어 분석 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
