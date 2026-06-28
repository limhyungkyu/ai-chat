import { TextToSpeechClient } from "@google-cloud/text-to-speech";

// Define the voice mapping for high-quality Google Cloud TTS voices
const VOICE_MAPPING = {
  "ko-KR": {
    "gcp_female_1": "ko-KR-Neural2-A",
    "gcp_female_2": "ko-KR-Neural2-B",
    "gcp_male_1": "ko-KR-Neural2-C",
    "gcp_male_2": "ko-KR-Wavenet-D"
  },
  "en-US": {
    "gcp_female_1": "en-US-Neural2-F",
    "gcp_female_2": "en-US-Journey-F",
    "gcp_male_1": "en-US-Neural2-D",
    "gcp_male_2": "en-US-Journey-D"
  },
  "ja-JP": {
    "gcp_female_1": "ja-JP-Neural2-B",
    "gcp_female_2": "ja-JP-Wavenet-A",
    "gcp_male_1": "ja-JP-Neural2-C",
    "gcp_male_2": "ja-JP-Wavenet-D"
  },
  "es-ES": {
    "gcp_female_1": "es-ES-Neural2-A",
    "gcp_female_2": "es-ES-Neural2-F",
    "gcp_male_1": "es-ES-Neural2-B",
    "gcp_male_2": "es-ES-Polyglot-1"
  },
  "vi-VN": {
    "gcp_female_1": "vi-VN-Neural2-A",
    "gcp_female_2": "vi-VN-Wavenet-A",
    "gcp_male_1": "vi-VN-Neural2-B",
    "gcp_male_2": "vi-VN-Wavenet-D"
  },
  "zh-CN": {
    "gcp_female_1": "zh-CN-Neural2-A",
    "gcp_female_2": "zh-CN-Neural2-F",
    "gcp_male_1": "zh-CN-Neural2-B",
    "gcp_male_2": "zh-CN-Wavenet-B"
  },
  "fr-FR": {
    "gcp_female_1": "fr-FR-Neural2-A",
    "gcp_female_2": "fr-FR-Neural2-C",
    "gcp_male_1": "fr-FR-Neural2-B",
    "gcp_male_2": "fr-FR-Neural2-D"
  },
  "de-DE": {
    "gcp_female_1": "de-DE-Neural2-A",
    "gcp_female_2": "de-DE-Neural2-C",
    "gcp_male_1": "de-DE-Neural2-B",
    "gcp_male_2": "de-DE-Neural2-F"
  }
};

const clientConfig = {
  projectId: process.env.GCP_PROJECT_ID || "sueaaz-ai-chat",
};

// Initialize credentials from env if manual service account variables are provided
if (process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY) {
  clientConfig.credentials = {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
}

const ttsClient = new TextToSpeechClient(clientConfig);

export async function POST(req) {
  try {
    const { text, lang, voice } = await req.json();
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: "음성으로 변환할 텍스트(text)가 누락되었습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const targetLang = lang || "en-US";
    let targetVoice = voice;

    // Map selected voice identifier to high-quality Neural2/Journey voices
    if (VOICE_MAPPING[targetLang] && VOICE_MAPPING[targetLang][voice]) {
      targetVoice = VOICE_MAPPING[targetLang][voice];
    } else if (voice && (voice.startsWith("gcp_") || voice.startsWith("ai_"))) {
      // Default fallback premium voice if selected identifier is generic
      const normalizedVoice = voice.replace("ai_", "gcp_");
      targetVoice = VOICE_MAPPING[targetLang]?.[normalizedVoice] || VOICE_MAPPING[targetLang]?.["gcp_female_1"] || `${targetLang}-Neural2-A`;
    } else if (!voice) {
      targetVoice = VOICE_MAPPING[targetLang]?.["gcp_female_1"] || `${targetLang}-Neural2-A`;
    }

    console.log(`[GCP TTS] Generating audio for text: "${text.substring(0, 30)}..." using voice: ${targetVoice} (Language: ${targetLang})`);

    const request = {
      input: { text },
      voice: { 
        languageCode: targetLang, 
        name: targetVoice 
      },
      audioConfig: { 
        audioEncoding: "MP3",
        // Increase speech rate slightly for better conversational flow
        speakingRate: 1.05
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioBuffer = response.audioContent;

    if (!audioBuffer) {
      throw new Error("GCP TTS API가 오디오 데이터를 반환하지 않았습니다.");
    }

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mp3",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error) {
    console.error("[GCP TTS] Error generating audio:", error);
    return new Response(
      JSON.stringify({ error: error.message || "음성 합성 중 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
