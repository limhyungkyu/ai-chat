import { GoogleGenerativeAI } from "@google/generative-ai";

function getWavHeader(dataLength, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(dataLength + 36, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // Raw PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

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
    
    // Choose gemini-3.1-flash-tts-preview as the dedicated text-to-speech model
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-tts-preview"
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
    const mimeType = part.inlineData.mimeType || "audio/l16; rate=24000; channels=1";
    const rawAudioBuffer = Buffer.from(base64Data, "base64");

    // If the mimeType is audio/l16, wrap it in a WAV container so standard HTML5 players can run it
    let finalAudioBuffer = rawAudioBuffer;
    let finalMimeType = "audio/wav";

    if (mimeType.includes("audio/l16")) {
      let sampleRate = 24000;
      const rateMatch = mimeType.match(/rate=(\d+)/);
      if (rateMatch) {
        sampleRate = parseInt(rateMatch[1], 10);
      }
      
      let channels = 1;
      const channelsMatch = mimeType.match(/channels=(\d+)/);
      if (channelsMatch) {
        channels = parseInt(channelsMatch[1], 10);
      }

      const wavHeader = getWavHeader(rawAudioBuffer.length, sampleRate, channels, 16);
      finalAudioBuffer = Buffer.concat([wavHeader, rawAudioBuffer]);
    } else {
      finalMimeType = mimeType;
    }

    return new Response(finalAudioBuffer, {
      status: 200,
      headers: {
        "Content-Type": finalMimeType,
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
