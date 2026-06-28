"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where } from "firebase/firestore";
import { LANGUAGES } from "@/lib/languages";
import { Send, Sparkles, Volume2, Copy, Menu, MessageSquare, AlertCircle, RefreshCw, Globe, HelpCircle, BookOpen, Star, Trash2, Search, Award, CheckCircle2, XCircle, ArrowRight, RotateCcw, Play } from "lucide-react";
import { ChatSkeleton } from "./LoadingSkeleton";

const getHostname = (urlStr) => {
  try {
    return new URL(urlStr).hostname;
  } catch (e) {
    return "";
  }
};

const parseContent = (content) => {
  if (!content) return { mainText: "", hoverTranslation: "", vocab: null };
  const parts = content.split("|||");
  let vocab = null;
  if (parts[2]) {
    try {
      vocab = JSON.parse(parts[2].trim());
    } catch (e) {
      console.warn("Failed to parse vocabulary JSON:", e);
      vocab = null;
    }
  }
  return {
    mainText: parts[0]?.trim() || "",
    hoverTranslation: parts[1]?.trim() || "",
    vocab: vocab
  };
};

const PERSONA_NAMES = {
  interpreter: "💼 전문 통역사",
  buddy: "⚡ 친근한 친구",
  guide: "🧭 여행 가이드",
  mentor: "🎓 요약 멘토",
  empath: "🌿 공감 동반자"
};

const LEVEL_NAMES = {
  beginner: "🌱 초급",
  intermediate: "🍀 중급",
  advanced: "🔥 고급/원어민"
};

const GEMINI_AI_VOICES = [
  { name: "ai_Aoede", label: "✨ Gemini AI: Aoede (따뜻한 여성)" },
  { name: "ai_Kore", label: "✨ Gemini AI: Kore (차분한 여성)" },
  { name: "ai_Puck", label: "✨ Gemini AI: Puck (경쾌한 남성)" },
  { name: "ai_Charon", label: "✨ Gemini AI: Charon (차분한 남성)" },
  { name: "ai_Fenrir", label: "✨ Gemini AI: Fenrir (신뢰감 있는 남성)" }
];

const PERSONA_EMOJIS = {
  interpreter: "💼",
  buddy: "⚡",
  guide: "🧭",
  mentor: "🎓",
  empath: "🌿"
};

export default function ChatArea({
  user,
  activeRoomId,
  onOpenAuth,
  onToggleMobileMenu
}) {
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [streamingResponse, setStreamingResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [currentGroundingMetadata, setCurrentGroundingMetadata] = useState(null);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [showVoiceGuide, setShowVoiceGuide] = useState(false);
  const [activeVocabMsgId, setActiveVocabMsgId] = useState(null);
  const [loadingVocabMsgId, setLoadingVocabMsgId] = useState(null);
  const [vocabErrorMsgId, setVocabErrorMsgId] = useState(null);
  const [vocabErrorText, setVocabErrorText] = useState("");
  const [savedVocabs, setSavedVocabs] = useState([]);
  const [vocabSearchQuery, setVocabSearchQuery] = useState("");
  const [selectedVocabLang, setSelectedVocabLang] = useState("all");
  const [vocabMode, setVocabMode] = useState("list"); // "list" | "quiz"
  const [quizState, setQuizState] = useState({
    questions: [],
    currentIdx: 0,
    selectedIdx: null,
    isAnswered: false,
    score: 0,
    wrongAnswers: [],
    isCompleted: false
  });

  const [toggledTranslations, setToggledTranslations] = useState({});
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sueaaz_autoplay_audio") === "true";
      setAutoPlayAudio(saved);
    }
  }, []);

  const handleToggleAutoPlay = () => {
    const newVal = !autoPlayAudio;
    setAutoPlayAudio(newVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("sueaaz_autoplay_audio", String(newVal));
    }
  };

  const handleToggleTranslation = (msgId) => {
    setToggledTranslations((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Real-time synchronization of bookmarked vocabularies
  useEffect(() => {
    if (!user) {
      setSavedVocabs([]);
      return;
    }

    const q = query(
      collection(db, "vocabularies"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vocabs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Client-side sorting by addedAt (descending)
      vocabs.sort((a, b) => {
        const t1 = a.addedAt?.toDate ? a.addedAt.toDate().getTime() : 0;
        const t2 = b.addedAt?.toDate ? b.addedAt.toDate().getTime() : 0;
        return t2 - t1;
      });
      setSavedVocabs(vocabs);
    }, (err) => {
      console.error("Error loading vocabulary book:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // Toggle saving/deleting vocabulary to Firestore
  const handleToggleVocab = async (vocabItem, langCode) => {
    if (!user) {
      onOpenAuth();
      return;
    }

    const isSaved = savedVocabs.some(v => v.word === vocabItem.word && v.langCode === langCode);

    try {
      if (isSaved) {
        const savedDoc = savedVocabs.find(v => v.word === vocabItem.word && v.langCode === langCode);
        if (savedDoc) {
          await deleteDoc(doc(db, "vocabularies", savedDoc.id));
        }
      } else {
        await addDoc(collection(db, "vocabularies"), {
          userId: user.uid,
          word: vocabItem.word,
          reading: vocabItem.reading || "",
          meaning: vocabItem.meaning || "",
          langCode: langCode || "ja",
          addedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Error toggling vocabulary:", e);
    }
  };

  // Start the interactive vocabulary quiz
  const handleStartQuiz = () => {
    if (savedVocabs.length < 4) return;

    // 1. Shuffle all saved vocabularies to pick questions (max 10)
    const shuffledList = [...savedVocabs].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffledList.slice(0, 10);

    // 2. Generate questions with multiple choice options
    const generatedQuestions = selectedQuestions.map((target) => {
      // Correct answer is the target word's meaning
      const correctAnswer = target.meaning;

      // Extract other words in the notebook as distractors
      const otherVocabs = savedVocabs.filter(v => v.word !== target.word);
      const shuffledOthers = otherVocabs.sort(() => Math.random() - 0.5);
      
      // Select 3 unique distractors (or fallback if not enough words)
      const distractors = [];
      const usedMeanings = new Set([correctAnswer]);
      
      for (let i = 0; i < shuffledOthers.length; i++) {
        const meaning = shuffledOthers[i].meaning;
        if (!usedMeanings.has(meaning)) {
          distractors.push(meaning);
          usedMeanings.add(meaning);
        }
        if (distractors.length === 3) break;
      }

      // Fallback in case we don't have enough unique meanings (extremely rare)
      while (distractors.length < 3) {
        distractors.push(`오답 보기 ${distractors.length + 1}`);
      }

      // Combine and shuffle the options (1 correct + 3 distractors)
      const options = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
      const correctIdx = options.indexOf(correctAnswer);

      return {
        word: target.word,
        reading: target.reading,
        meaning: target.meaning,
        langCode: target.langCode,
        options,
        correctIdx
      };
    });

    setQuizState({
      questions: generatedQuestions,
      currentIdx: 0,
      selectedIdx: null,
      isAnswered: false,
      score: 0,
      wrongAnswers: [],
      isCompleted: false
    });
  };

  // Handle option click in quiz
  const handleSelectOption = (idx) => {
    if (quizState.isAnswered) return;

    const currentQuestion = quizState.questions[quizState.currentIdx];
    const isCorrect = idx === currentQuestion.correctIdx;

    setQuizState((prev) => {
      const updatedWrongAnswers = isCorrect
        ? prev.wrongAnswers
        : [...prev.wrongAnswers, currentQuestion];

      return {
        ...prev,
        selectedIdx: idx,
        isAnswered: true,
        score: isCorrect ? prev.score + 1 : prev.score,
        wrongAnswers: updatedWrongAnswers
      };
    });
  };

  // Move to next question or complete quiz
  const handleNextQuestion = () => {
    setQuizState((prev) => {
      const nextIdx = prev.currentIdx + 1;
      const isCompleted = nextIdx >= prev.questions.length;

      return {
        ...prev,
        currentIdx: isCompleted ? prev.currentIdx : nextIdx,
        selectedIdx: null,
        isAnswered: false,
        isCompleted
      };
    });
  };

  // Fetch Room Info
  useEffect(() => {
    if (!activeRoomId || !user) {
      setRoom(null);
      setMessages([]);
      return;
    }

    const roomRef = doc(db, "rooms", activeRoomId);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoom({ id: snapshot.id, ...snapshot.data() });
      }
    }, (err) => {
      if (err.code !== "permission-denied") {
        console.error("Error fetching room info:", err);
      }
    });

    // Fetch Messages
    setLoadingMessages(true);
    const messagesQuery = query(
      collection(db, "rooms", activeRoomId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      setLoadingMessages(false);
      scrollToBottom();
    }, (err) => {
      if (err.code !== "permission-denied") {
        console.error("Error fetching messages:", err);
      }
      setLoadingMessages(false);
    });

    return () => {
      unsubscribeRoom();
      unsubscribeMessages();
    };
  }, [activeRoomId, user]);

  // Scroll to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingResponse, isStreaming]);

  // Textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput]);

  // Fetch and update TTS voices based on the room's output language
  const updateAvailableVoices = () => {
    if (typeof window === "undefined" || !window.speechSynthesis || !room) return;
    const voices = window.speechSynthesis.getVoices();
    const langCode = room.outputLang;
    
    const langMap = {
      "ko": "ko-KR",
      "ja": "ja-JP",
      "en": "en-US",
      "es": "es-ES",
      "vi": "vi-VN",
      "zh": "zh-CN",
      "fr": "fr-FR",
      "de": "de-DE"
    };
    
    const targetLang = langMap[langCode] || langCode || "en-US";
    const langPrefix = targetLang.split("-")[0].toLowerCase();
    const ISO3_MAP = { ko: "kor", ja: "jpn", en: "eng", es: "spa", vi: "vie", zh: "chi", fr: "fra", de: "deu" };
    const iso3 = ISO3_MAP[langPrefix] || "";
    
    const matchingVoices = voices.filter(v => {
      const vl = v.lang.toLowerCase().replace("_", "-");
      return vl.startsWith(langPrefix) || (iso3 && vl.startsWith(iso3));
    });
    
    setAvailableVoices(matchingVoices);
    
    // Load preference from localStorage
    const savedVoice = localStorage.getItem(`selected_voice_${targetLang}`);
    if (savedVoice && (savedVoice.startsWith("ai_") || matchingVoices.some(v => v.name === savedVoice))) {
      setSelectedVoiceName(savedVoice);
    } else {
      // Default to the premium Gemini AI voice for the best out-of-the-box experience
      setSelectedVoiceName("ai_Aoede");
    }
  };

  // Sync available voices on mount, output language change, or voice list changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      // Warm up voice loading immediately
      window.speechSynthesis.getVoices();
      
      updateAvailableVoices();
      
      const handleVoicesChanged = () => {
        updateAvailableVoices();
      };
      
      window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
      
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        window.speechSynthesis.cancel();
      };
    }
  }, [room?.outputLang]);

  const speakText = async (text, langCode, msgId = null, isWordOnly = false) => {
    if (typeof window === "undefined") return;

    // 1. Stop any currently active speech
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If clicking the same message that is already speaking, we toggle it off (Stop)
    if (msgId && speakingMessageId === msgId) {
      setSpeakingMessageId(null);
      return;
    }

    // Clean up text (strip emojis)
    let cleanedText = text;
    if (!isWordOnly) {
      const parsed = parseContent(text);
      cleanedText = parsed.mainText;
    }
    if (!cleanedText) return;

    try {
      cleanedText = cleanedText.replace(/\p{Extended_Pictographic}/gu, "").replace(/[\u200d\ufe0f]/g, "").trim();
    } catch (e) {
      cleanedText = cleanedText.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, "").trim();
    }

    const langMap = {
      "ko": "ko-KR",
      "ja": "ja-JP",
      "en": "en-US",
      "es": "es-ES",
      "vi": "vi-VN",
      "zh": "zh-CN",
      "fr": "fr-FR",
      "de": "de-DE"
    };
    const targetLang = langMap[langCode] || langCode || "en-US";

    // 2. Identify if the current voice is a Gemini AI voice
    const activeVoiceName = localStorage.getItem(`selected_voice_${targetLang}`) || selectedVoiceName || "ai_Aoede";
    const isAiVoice = activeVoiceName.startsWith("ai_");

    if (msgId) {
      setSpeakingMessageId(msgId);
    }

    if (isAiVoice) {
      try {
        const geminiVoice = activeVoiceName.replace("ai_", ""); // e.g. "Aoede"
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanedText, lang: langCode, voice: geminiVoice })
        });

        if (!response.ok) {
          throw new Error("Failed to fetch audio from TTS API");
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          if (msgId) setSpeakingMessageId(null);
          URL.revokeObjectURL(audioUrl);
          if (audioRef.current === audio) audioRef.current = null;
        };

        audio.onerror = () => {
          if (msgId) setSpeakingMessageId(null);
          URL.revokeObjectURL(audioUrl);
          if (audioRef.current === audio) audioRef.current = null;
          // Fallback to browser speechSynthesis
          speakWithBrowserTts(cleanedText, targetLang, msgId);
        };

        await audio.play();
      } catch (err) {
        console.warn("[TTS] AI speech generation/playback failed. Falling back to browser TTS:", err);
        speakWithBrowserTts(cleanedText, targetLang, msgId);
      }
    } else {
      speakWithBrowserTts(cleanedText, targetLang, msgId);
    }
  };

  const speakWithBrowserTts = (text, targetLang, msgId) => {
    if (!window.speechSynthesis) {
      if (msgId) setSpeakingMessageId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang;

    const voices = window.speechSynthesis.getVoices();
    const savedVoiceName = localStorage.getItem(`selected_voice_${targetLang}`) || selectedVoiceName;
    let matchedVoice = voices.find(v => v.name === savedVoiceName);
    
    const langPrefix = targetLang.split("-")[0].toLowerCase();
    const ISO3_MAP = { ko: "kor", ja: "jpn", en: "eng", es: "spa", vi: "vie", zh: "chi", fr: "fra", de: "deu" };
    const iso3 = ISO3_MAP[langPrefix] || "";
    
    const isLanguageMatch = matchedVoice && (
      matchedVoice.lang.toLowerCase().replace("_", "-").startsWith(langPrefix) || 
      (iso3 && matchedVoice.lang.toLowerCase().replace("_", "-").startsWith(iso3))
    );

    if (matchedVoice && isLanguageMatch) {
      utterance.lang = matchedVoice.lang.replace("_", "-");
      utterance.voice = matchedVoice;
    } else {
      const matchingVoices = voices.filter(v => {
        const vl = v.lang.toLowerCase().replace("_", "-");
        return vl.startsWith(langPrefix) || (iso3 && vl.startsWith(iso3));
      });
      
      if (matchingVoices.length > 0) {
        const siriVoice = matchingVoices.find(v => v.name.toLowerCase().includes("siri"));
        const googleVoice = matchingVoices.find(v => v.name.toLowerCase().includes("google"));
        const premiumVoice = matchingVoices.find(v => v.name.toLowerCase().includes("premium") || v.name.toLowerCase().includes("enhanced"));
        
        let customFav = null;
        if (langPrefix === "ko") {
          customFav = matchingVoices.find(v => v.name.includes("Yuna") || v.name.includes("Suri") || v.name.includes("Siri"));
        } else if (langPrefix === "ja") {
          customFav = matchingVoices.find(v => v.name.includes("Otoya") || v.name.includes("Kyoko") || v.name.includes("Siri"));
        } else if (langPrefix === "en") {
          customFav = matchingVoices.find(v => v.name.includes("Samantha") || v.name.includes("Daniel") || v.name.includes("Siri"));
        }
        
        const bestVoice = customFav || siriVoice || googleVoice || premiumVoice || matchingVoices[0];
        if (bestVoice) {
          utterance.lang = bestVoice.lang.replace("_", "-");
          utterance.voice = bestVoice;
        }
      }
    }

    utterance.onend = () => {
      if (msgId) setSpeakingMessageId(null);
    };
    utterance.onerror = () => {
      if (msgId) setSpeakingMessageId(null);
    };

    if (msgId) {
      setSpeakingMessageId(msgId);
    }
    window.speechSynthesis.speak(utterance);
  };

  // Speak single word using browser Text-to-Speech (TTS) or Gemini AI voice
  const handleSpeakWord = (word, langCode) => {
    speakText(word, langCode, null, true);
  };

  // Analyze sentence and generate vocabulary guide on demand for older messages
  const handleAnalyzeVocab = async (msgId, contentText, langCode) => {
    if (loadingVocabMsgId) return;
    setLoadingVocabMsgId(msgId);
    setVocabErrorMsgId(null);
    setVocabErrorText("");
    try {
      const parsed = parseContent(contentText);
      const mainText = parsed.mainText;
      
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: mainText, lang: langCode })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "단어 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
      
      const data = await response.json();
      if (data.vocab && data.vocab.length > 0) {
        const originalContent = contentText.split("|||").slice(0, 2).join("|||");
        const newContent = `${originalContent}|||${JSON.stringify(data.vocab)}`;
        
        await updateDoc(doc(db, "rooms", activeRoomId, "messages", msgId), {
          content: newContent
        });
      }
    } catch (err) {
      console.error("Failed to analyze vocabulary on demand:", err);
      setVocabErrorMsgId(msgId);
      setVocabErrorText(err.message || "단어 분석 중 오류가 발생했습니다.");
    } finally {
      setLoadingVocabMsgId(null);
    }
  };

  // Speak text using browser Text-to-Speech (TTS) or Gemini AI voice
  const handleSpeak = (text, langCode, msgId) => {
    speakText(text, langCode, msgId, false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!activeRoomId || !room) return;

    const messageText = userInput.trim();
    setUserInput("");
    setError("");
    setIsStreaming(true);
    setStreamingResponse("");
    setCurrentGroundingMetadata(null);

    try {
      // 1. Save user message to Firestore
      const userMessageRef = await addDoc(
        collection(db, "rooms", activeRoomId, "messages"),
        {
          role: "user",
          content: messageText,
          createdAt: serverTimestamp()
        }
      );

      // Update room updatedAt
      await updateDoc(doc(db, "rooms", activeRoomId), {
        updatedAt: serverTimestamp()
      });

      // 2. Fetch recent conversation history (last 10 messages for context)
      const chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content
      }));

      // Find selected languages metadata
      const inputLang = LANGUAGES.find((l) => l.code === room.inputLang) || LANGUAGES[0];
      const outputLang = LANGUAGES.find((l) => l.code === room.outputLang) || LANGUAGES[1];

      // 3. Request translation response stream from Gemini Route
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          history: chatHistory,
          inputLang: inputLang.name,
          outputLang: outputLang.name,
          persona: room.persona || "interpreter",
          languageLevel: room.languageLevel || "advanced"
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "서버 응답 오류가 발생했습니다.");
      }

      // 4. Read the SSE Stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let fullAIContent = "";
      let accumulatedMetadata = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        
        // Parse SSE Lines
        const lines = streamBuffer.split("\n");
        // Keep the last partial line in the buffer
        streamBuffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith("data: ")) {
            const dataStr = cleanLine.substring(6);
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                fullAIContent += parsed.text;
                setStreamingResponse(fullAIContent);
              }
              if (parsed.groundingMetadata) {
                if (!accumulatedMetadata) {
                  accumulatedMetadata = {};
                }
                if (parsed.groundingMetadata.webSearchQueries) {
                  accumulatedMetadata.webSearchQueries = [
                    ...new Set([
                      ...(accumulatedMetadata.webSearchQueries || []),
                      ...parsed.groundingMetadata.webSearchQueries
                    ])
                  ];
                }
                if (parsed.groundingMetadata.groundingChunks) {
                  accumulatedMetadata.groundingChunks = [
                    ...(accumulatedMetadata.groundingChunks || []),
                    ...parsed.groundingMetadata.groundingChunks
                  ];
                  // De-duplicate by URI
                  const seenUris = new Set();
                  accumulatedMetadata.groundingChunks = accumulatedMetadata.groundingChunks.filter(chunk => {
                    const uri = chunk.web?.uri;
                    if (!uri) return true;
                    if (seenUris.has(uri)) return false;
                    seenUris.add(uri);
                    return true;
                  });
                }
                setCurrentGroundingMetadata({ ...accumulatedMetadata });
              }
            } catch (err) {
              console.error("Error parsing SSE chunk:", err);
            }
          }
        }
      }

      // 5. Stream finished. Save AI message to Firestore
      if (fullAIContent) {
        const docRef = await addDoc(collection(db, "rooms", activeRoomId, "messages"), {
          role: "model",
          content: fullAIContent,
          createdAt: serverTimestamp(),
          groundingMetadata: accumulatedMetadata || null
        });
        
        if (autoPlayAudio) {
          speakText(fullAIContent, outputLangInfo.code, docRef.id, false);
        }
      }
    } catch (err) {
      console.error("AI translation error:", err);
      setError(err.message || "답변을 가져오는 중 오류가 발생했습니다. API Key 설정을 확인해 주세요.");
    } finally {
      setIsStreaming(false);
      setStreamingResponse("");
      setCurrentGroundingMetadata(null);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    // Simple visual notification can be added later
  };

  // Find languages metadata for UI
  const inputLangInfo = room
    ? LANGUAGES.find((l) => l.code === room.inputLang) || LANGUAGES[0]
    : LANGUAGES[0];
  const outputLangInfo = room
    ? LANGUAGES.find((l) => l.code === room.outputLang) || LANGUAGES[1]
    : LANGUAGES[1];

  return (
    <main className="flex-1 flex flex-col h-full ml-0 md:ml-72 relative z-10 text-on-surface overflow-hidden">
      {/* Top Header */}
      <header className="shrink-0 z-50 flex justify-between items-center px-4 md:px-6 py-4 w-full backdrop-saturate-150 bg-white/90 md:bg-white/60 backdrop-blur-xl border-b border-primary/10 shadow-sm">
        <div className="flex-1 min-w-0 flex items-center space-x-2 md:space-x-3">
          {/* Mobile Menu Hamburger */}
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-2 rounded-xl bg-white/40 hover:bg-primary/10 text-on-surface/80 flex-shrink-0 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="font-headline font-semibold text-primary text-sm md:text-lg truncate">
              {activeRoomId === "vocab" ? "📝 내 단어장" : (room ? room.title : "대화를 선택해 주세요")}
            </h2>
            <div className="flex items-center mt-0.5 md:mt-1 space-x-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80] flex-shrink-0"></span>
              <span className="text-[9px] md:text-xs text-on-surface/60 font-semibold truncate">
                {activeRoomId === "vocab" ? "저장된 단어 실시간 동기화됨" : "대화 상대 연결됨 (Active)"}
              </span>
            </div>
          </div>

          {activeRoomId === "vocab" && (
            <div className="hidden sm:flex items-center space-x-1.5 glass-panel px-3 py-1 rounded-full text-xs font-semibold bg-primary/5 text-primary border border-primary/10 flex-shrink-0">
              <span className="opacity-85">총 {savedVocabs.length}개 단어 수집됨</span>
            </div>
          )}

          {room && activeRoomId !== "vocab" && (
            <>
              <div className="hidden sm:flex items-center space-x-1.5 glass-panel px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0">
                <span className="opacity-80">{inputLangInfo.flag} {inputLangInfo.name}</span>
                <span className="text-primary text-[10px] font-bold">➔</span>
                <span className="opacity-80">{outputLangInfo.flag} {outputLangInfo.name}</span>
              </div>
              <div className="hidden md:flex items-center space-x-1.5 glass-panel px-3 py-1 rounded-full text-xs font-semibold bg-white/50 flex-shrink-0">
                <span className="opacity-80">{PERSONA_NAMES[room.persona || "interpreter"]}</span>
              </div>
              <div className="hidden md:flex items-center space-x-1.5 glass-panel px-3 py-1 rounded-full text-xs font-semibold bg-white/50 flex-shrink-0">
                <span className="opacity-80">{LEVEL_NAMES[room.languageLevel || "advanced"]}</span>
              </div>
            </>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {room && (
            <div className="flex items-center space-x-2">
              {/* Auto-Play Toggle */}
              <button
                type="button"
                onClick={handleToggleAutoPlay}
                className={`p-1.5 sm:p-2 rounded-full border transition-all duration-300 cursor-pointer flex items-center justify-center ${
                  autoPlayAudio
                    ? "bg-primary text-white border-primary/20 shadow-md shadow-primary/15 hover:bg-primary/95 active:scale-95"
                    : "bg-white/40 border-primary/10 text-on-surface/50 hover:bg-white/60 hover:text-primary active:scale-95"
                }`}
                title={autoPlayAudio ? "음성 자동 재생 켜짐 (클릭 시 끔)" : "음성 자동 재생 꺼짐 (클릭 시 켬)"}
              >
                <Play className={`w-3.5 h-3.5 ${autoPlayAudio ? "fill-current" : ""}`} />
              </button>

              {/* Voice select box */}
              <div className="flex items-center space-x-1.5 glass-panel px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold bg-white/40 border border-primary/10 transition-all duration-300 hover:bg-white/60">
                <Volume2 className="w-3.5 h-3.5 text-primary" />
                <select
                  value={selectedVoiceName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedVoiceName(val);
                    const langMap = {
                      "ko": "ko-KR",
                      "ja": "ja-JP",
                      "en": "en-US",
                      "es": "es-ES",
                      "vi": "vi-VN",
                      "zh": "zh-CN",
                      "fr": "fr-FR",
                      "de": "de-DE"
                    };
                    const targetLang = langMap[room.outputLang] || room.outputLang || "en-US";
                    localStorage.setItem(`selected_voice_${targetLang}`, val);
                  }}
                  className="bg-transparent text-[9px] sm:text-[11px] font-medium text-on-surface/80 border-none outline-none focus:ring-0 cursor-pointer max-w-[60px] xs:max-w-[85px] sm:max-w-[120px] md:max-w-[140px] truncate"
                >
                  <optgroup label="Premium Gemini AI Voices" className="text-[10px] font-bold text-primary bg-surface font-sans">
                    {GEMINI_AI_VOICES.map((v) => (
                      <option key={v.name} value={v.name} className="text-on-surface bg-surface font-sans text-xs font-normal">
                        {v.label}
                      </option>
                    ))}
                  </optgroup>
                  {availableVoices.length > 0 && (
                    <optgroup label="System / Browser Voices" className="text-[10px] font-bold text-on-surface/60 bg-surface font-sans">
                      {availableVoices.map((voice) => (
                        <option key={voice.name} value={voice.name} className="text-on-surface bg-surface font-sans text-xs font-normal">
                          {voice.name
                            .replace(/Google/gi, "구글")
                            .replace(/Microsoft/gi, "MS")
                            .replace(/Siri/gi, "시리")
                            .replace(/Apple/gi, "애플")
                            .replace(/Natural/gi, "내추럴")
                            .replace(/Neural/gi, "인공지능")
                            .replace(/\([a-zA-Z]{2}-[a-zA-Z]{2}\)/g, "")
                            .trim()}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button 
                  type="button"
                  onClick={() => setShowVoiceGuide(true)}
                  className="p-0.5 rounded-full text-on-surface/50 hover:text-primary hover:bg-white/40 transition-all cursor-pointer flex items-center justify-center ml-0.5"
                  title="음질 개선 가이드"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          {room && (
            <div className="sm:hidden flex items-center space-x-1 bg-white/40 border border-primary/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <span>{inputLangInfo.flag}</span>
              <span>➔</span>
              <span>{outputLangInfo.flag}</span>
            </div>
          )}
          <div className="relative">
            <div className="w-8 h-8 rounded-full border border-white/20 bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-white font-bold text-xs shadow-lg">
              {user ? (user.email ? user.email[0].toUpperCase() : "U") : "G"}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
        </div>
      </header>

      {/* Messages Canvas */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-4">
        {activeRoomId === "vocab" ? (
          /* Render Vocabulary Notebook View */
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in text-left">
            
            {/* Mode Selector Tabs */}
            <div className="flex space-x-1.5 p-1 rounded-2xl glass-panel bg-white/40 border border-primary/10 max-w-xs md:max-w-md">
              <button
                onClick={() => setVocabMode("list")}
                className={`flex-1 py-2 px-3 md:py-2.5 md:px-4 rounded-xl text-[11px] md:text-xs font-headline font-semibold flex items-center justify-center space-x-1.5 md:space-x-2 transition-all cursor-pointer ${
                  vocabMode === "list"
                    ? "bg-primary text-white shadow-md shadow-primary/15"
                    : "text-on-surface/75 hover:bg-primary/5 hover:text-primary"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>📇 단어 카드 목록</span>
              </button>
              <button
                onClick={() => {
                  setVocabMode("quiz");
                  handleStartQuiz();
                }}
                className={`flex-1 py-2 px-3 md:py-2.5 md:px-4 rounded-xl text-[11px] md:text-xs font-headline font-semibold flex items-center justify-center space-x-1.5 md:space-x-2 transition-all cursor-pointer ${
                  vocabMode === "quiz"
                    ? "bg-primary text-white shadow-md shadow-primary/15"
                    : "text-on-surface/75 hover:bg-primary/5 hover:text-primary"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>🧩 객관식 단어 퀴즈</span>
              </button>
            </div>

            {vocabMode === "list" ? (
              /* LIST MODE VIEW */
              <div className="space-y-6 animate-fade-in">
                {/* Search and Language filter panel */}
                <div className="glass-panel p-4 md:p-6 rounded-2xl border border-primary/10 bg-white/40 space-y-4 shadow-sm">
                  <div className="relative group">
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-on-surface/40 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      placeholder="단어(Word) 또는 뜻(Meaning)을 실시간 검색해 보세요..."
                      value={vocabSearchQuery}
                      onChange={(e) => setVocabSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/50 border border-primary/10 focus:outline-none focus:border-primary/45 focus:bg-white/80 transition-all text-sm"
                    />
                  </div>

                  {/* Language filter caps */}
                  <div className="flex overflow-x-auto gap-2 pt-1 pb-1.5 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                    <button
                      onClick={() => setSelectedVocabLang("all")}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        selectedVocabLang === "all"
                          ? "bg-primary text-white shadow-md shadow-primary/15"
                          : "bg-white/60 text-on-surface/75 hover:bg-primary/10 border border-primary/5"
                      }`}
                    >
                      전체보기 ({savedVocabs.length})
                    </button>
                    {Array.from(new Set(savedVocabs.map(v => v.langCode))).map(code => {
                      const map = {
                        ja: { flag: "🇯🇵", name: "일본어" },
                        en: { flag: "🇺🇸", name: "영어" },
                        zh: { flag: "🇨🇳", name: "중국어" },
                        ko: { flag: "🇰🇷", name: "한국어" },
                        es: { flag: "🇪🇸", name: "스페인어" },
                        vi: { flag: "🇻🇳", name: "베트남어" },
                        fr: { flag: "🇫🇷", name: "프랑스어" },
                        de: { flag: "🇩🇪", name: "독일어" }
                      };
                      const meta = map[code] || { flag: "🌐", name: code.toUpperCase() };
                      const count = savedVocabs.filter(v => v.langCode === code).length;
                      return (
                        <button
                          key={code}
                          onClick={() => setSelectedVocabLang(code)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                            selectedVocabLang === code
                              ? "bg-primary text-white shadow-md shadow-primary/15"
                              : "bg-white/60 text-on-surface/75 hover:bg-primary/10 border border-primary/5"
                          }`}
                        >
                          <span>{meta.flag}</span>
                          <span>{meta.name} ({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* List of saved word cards */}
                {(() => {
                  const filtered = savedVocabs.filter(v => {
                    const matchesLang = selectedVocabLang === "all" || v.langCode === selectedVocabLang;
                    const matchesSearch = !vocabSearchQuery.trim() || 
                      v.word.toLowerCase().includes(vocabSearchQuery.toLowerCase()) ||
                      v.meaning.toLowerCase().includes(vocabSearchQuery.toLowerCase()) ||
                      (v.reading && v.reading.toLowerCase().includes(vocabSearchQuery.toLowerCase()));
                    return matchesLang && matchesSearch;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="glass-panel p-8 text-center rounded-2xl border border-primary/10 bg-white/40 shadow-sm flex flex-col items-center justify-center space-y-4 py-16">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                          <BookOpen className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-on-surface">저장된 단어가 없습니다</h4>
                          <p className="text-xs text-on-surface/50 max-w-xs mt-1.5 leading-relaxed mx-auto">
                            {vocabSearchQuery.trim() 
                              ? "검색어와 일치하는 단어가 없습니다. 다른 키워드로 검색해 보세요!"
                              : "AI 동반자와 대화 중 모르는 단어 카드 옆의 별표(☆)를 누르면 이곳에 저장되어 언제든 다시 학습할 수 있어요!"}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filtered.map((item) => {
                        const map = {
                          ja: { flag: "🇯🇵", name: "일본어" },
                          en: { flag: "🇺🇸", name: "영어" },
                          zh: { flag: "🇨🇳", name: "중국어" },
                          ko: { flag: "🇰🇷", name: "한국어" },
                          es: { flag: "🇪🇸", name: "스페인어" },
                          vi: { flag: "🇻🇳", name: "베트남어" },
                          fr: { flag: "🇫🇷", name: "프랑스어" },
                          de: { flag: "🇩🇪", name: "독일어" }
                        };
                        const meta = map[item.langCode] || { flag: "🌐", name: item.langCode.toUpperCase() };

                        return (
                          <div
                            key={item.id}
                            className="glass-panel p-4.5 rounded-2xl border border-primary/10 hover:border-primary/25 bg-white/40 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] bg-primary/5 text-primary border border-primary/10 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span>{meta.flag}</span>
                                  <span>{meta.name}</span>
                                </span>
                                <span className="text-[9px] text-on-surface/40 font-semibold">
                                  {item.addedAt?.toDate ? item.addedAt.toDate().toLocaleDateString() : ""}
                                </span>
                              </div>

                              <div className="pt-1.5">
                                <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
                                  <h3 className="text-lg font-bold text-on-surface font-headline leading-tight">
                                    {item.word}
                                  </h3>
                                  {item.reading && (
                                    <span className="text-[10.5px] bg-primary-container text-on-primary-container font-medium px-2 py-0.2 rounded-full leading-normal">
                                      {item.reading}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-on-surface/80 mt-2 font-medium leading-relaxed">
                                  {item.meaning}
                                </p>
                              </div>
                            </div>

                            {/* Card Action Row */}
                            <div className="flex items-center justify-end space-x-2 mt-4 pt-3.5 border-t border-primary/5">
                              <button
                                onClick={() => handleSpeakWord(item.word, item.langCode)}
                                className="p-2 rounded-xl bg-white/60 hover:bg-primary hover:text-white border border-primary/5 text-on-surface/60 hover:shadow-md transition-all cursor-pointer"
                                title="발음 듣기"
                              >
                                <Volume2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleVocab(item, item.langCode)}
                                className="p-2 rounded-xl bg-white/60 hover:bg-red-500 hover:text-white border border-primary/5 text-red-500 hover:shadow-md transition-all cursor-pointer"
                                title="단어 삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* QUIZ MODE VIEW */
              <div className="space-y-6 animate-fade-in">
                {savedVocabs.length < 4 ? (
                  /* Warning: Not enough words */
                  <div className="glass-panel p-8 text-center rounded-2xl border border-primary/10 bg-white/40 shadow-sm flex flex-col items-center justify-center space-y-4 py-16">
                    <div className="h-14 w-14 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600 border border-yellow-500/20">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-on-surface">퀴즈를 준비할 수 없습니다</h4>
                      <p className="text-xs text-on-surface/50 max-w-sm mt-1.5 leading-relaxed mx-auto">
                        객관식 퀴즈(4지 선다형)를 생성하기 위해서는 **최소 4개 이상의 단어**가 단어장에 등록되어 있어야 합니다.
                        AI와의 번역 대화에서 유용한 단어들을 더 수집해 보세요!
                      </p>
                    </div>
                    <button
                      onClick={() => setVocabMode("list")}
                      className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                      단어 목록으로 돌아가기
                    </button>
                  </div>
                ) : quizState.isCompleted ? (
                  /* Quiz Result Screen */
                  <div className="glass-panel p-5 md:p-8 rounded-2xl border border-primary/10 bg-white/40 shadow-sm text-center space-y-6 animate-scale-up">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="h-20 w-20 rounded-full bg-yellow-100 flex items-center justify-center border-4 border-yellow-200 animate-bounce">
                        <Award className="w-10 h-10 text-yellow-600" />
                      </div>
                      <h3 className="text-2xl font-bold font-headline mt-2">퀴즈를 모두 완료했습니다!</h3>
                      <p className="text-sm text-on-surface/50">수고하셨습니다! 결과를 확인하고 학습을 강화해 보세요.</p>
                    </div>

                    {/* Score display */}
                    <div className="max-w-xs mx-auto glass-panel border border-primary/10 p-5 rounded-2xl bg-white/60 shadow-sm">
                      <p className="text-[10px] text-primary uppercase font-bold tracking-widest mb-1">최종 스코어</p>
                      <h4 className="text-4xl font-black text-primary font-headline">
                        {quizState.score} <span className="text-base font-semibold text-on-surface/50">/ {quizState.questions.length} 정답</span>
                      </h4>
                      <div className="w-full bg-primary/10 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-1000" 
                          style={{ width: `${(quizState.score / quizState.questions.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Wrong Answers Review Note */}
                    {quizState.wrongAnswers.length > 0 && (
                      <div className="text-left space-y-3 pt-4 border-t border-primary/5">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-red-500">✍️ 오답 노트 & 집중 학습</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {quizState.wrongAnswers.map((item, idx) => (
                            <div key={idx} className="bg-red-50/40 hover:bg-red-50/70 border border-red-200/40 p-3 rounded-xl flex items-center justify-between text-xs transition-colors">
                              <div>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="font-bold text-on-surface leading-tight text-sm font-headline">{item.word}</span>
                                  {item.reading && <span className="text-[9px] bg-red-100/50 text-red-700 px-1 rounded">{item.reading}</span>}
                                </div>
                                <p className="text-[10.5px] text-on-surface/75 mt-1 font-semibold">{item.meaning}</p>
                              </div>
                              <button
                                onClick={() => handleSpeakWord(item.word, item.langCode)}
                                className="p-1.5 rounded-lg bg-white/60 hover:bg-primary hover:text-white text-on-surface/60 transition-all cursor-pointer"
                                title="발음 듣기"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4 border-t border-primary/5">
                      <button
                        onClick={handleStartQuiz}
                        className="py-3 px-6 bg-primary hover:bg-primary/95 text-white text-sm font-semibold rounded-xl shadow-md shadow-primary/10 hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>다시 도전하기</span>
                      </button>
                      <button
                        onClick={() => setVocabMode("list")}
                        className="py-3 px-6 bg-white hover:bg-primary/5 border border-primary/10 text-on-surface hover:text-primary text-sm font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>단어 목록보기</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Active Quiz Playing Screen */
                  (() => {
                    const currentQuestion = quizState.questions[quizState.currentIdx];
                    if (!currentQuestion) return null;

                    const map = {
                      ja: { flag: "🇯🇵", name: "일본어" },
                      en: { flag: "🇺🇸", name: "영어" },
                      zh: { flag: "🇨🇳", name: "중국어" },
                      ko: { flag: "🇰🇷", name: "한국어" },
                      es: { flag: "🇪🇸", name: "스페인어" },
                      vi: { flag: "🇻🇳", name: "베트남어" },
                      fr: { flag: "🇫🇷", name: "프랑스어" },
                      de: { flag: "🇩🇪", name: "독일어" }
                    };
                    const meta = map[currentQuestion.langCode] || { flag: "🌐", name: currentQuestion.langCode.toUpperCase() };

                    return (
                      <div className="glass-panel p-5 md:p-8 rounded-2xl border border-primary/10 bg-white/40 shadow-sm space-y-6 animate-fade-in flex flex-col">
                        
                        {/* Progress Bar Header */}
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[10px] bg-primary/5 text-primary border border-primary/10 font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5">
                            <span>{meta.flag}</span>
                            <span>{meta.name} 퀴즈</span>
                          </span>
                          <span className="font-semibold text-on-surface/60">
                            문제 <span className="text-primary font-bold">{quizState.currentIdx + 1}</span> / {quizState.questions.length}
                          </span>
                        </div>
                        <div className="w-full bg-primary/10 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${((quizState.currentIdx + 1) / quizState.questions.length) * 100}%` }}
                          />
                        </div>

                        {/* Target Question Big Card */}
                        <div className="bg-primary/5 border border-primary/10 p-5 md:p-8 rounded-2xl text-center relative group min-h-[120px] md:min-h-[160px] flex flex-col justify-center items-center">
                          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-on-surface font-headline tracking-tight leading-normal">
                            {currentQuestion.word}
                          </h2>
                          {currentQuestion.reading && quizState.isAnswered && (
                            <span className="text-xs bg-primary-container text-on-primary-container font-medium px-2.5 py-0.5 rounded-full mt-2 animate-fade-in">
                              {currentQuestion.reading}
                            </span>
                          )}
                          <button
                            onClick={() => handleSpeakWord(currentQuestion.word, currentQuestion.langCode)}
                            className="absolute bottom-3 right-3 p-2 rounded-xl bg-white hover:bg-primary hover:text-white border border-primary/5 shadow-sm text-on-surface/60 transition-all cursor-pointer"
                            title="발음 힌트 듣기"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 4-Option Grid Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentQuestion.options.map((opt, idx) => {
                            const isSelected = quizState.selectedIdx === idx;
                            const isCorrectOpt = idx === currentQuestion.correctIdx;
                            
                            let btnStyle = "bg-white/50 border-primary/10 hover:bg-primary/5 text-on-surface hover:border-primary/20";
                            let icon = null;

                            if (quizState.isAnswered) {
                              if (isCorrectOpt) {
                                // Real Correct Option always turns Green
                                btnStyle = "bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold shadow-md shadow-emerald-500/5";
                                icon = <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />;
                              } else if (isSelected && !isCorrectOpt) {
                                // Incorrect choice turns Red
                                btnStyle = "bg-rose-50 border-rose-300 text-rose-800 font-semibold";
                                icon = <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />;
                              } else {
                                // Others are faded out slightly
                                btnStyle = "bg-white/30 border-primary/5 text-on-surface/40 pointer-events-none";
                              }
                            }

                            return (
                              <button
                                key={idx}
                                onClick={() => handleSelectOption(idx)}
                                disabled={quizState.isAnswered}
                                className={`p-4 rounded-xl border text-left text-sm font-semibold transition-all duration-300 flex items-center justify-between cursor-pointer group disabled:cursor-default ${btnStyle}`}
                              >
                                <span className="pr-2">{opt}</span>
                                {icon}
                              </button>
                            );
                          })}
                        </div>

                        {/* Next slide button */}
                        {quizState.isAnswered && (
                          <div className="pt-2 animate-slide-up w-full sm:w-auto flex justify-end">
                            <button
                              onClick={handleNextQuestion}
                              className="w-full sm:w-auto py-3 px-6 bg-primary hover:bg-primary/95 text-white text-xs font-semibold rounded-xl shadow-md shadow-primary/15 hover:shadow-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                            >
                              <span>
                                {quizState.currentIdx + 1 === quizState.questions.length ? "결과 보러가기" : "다음 문제로"}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        ) : !activeRoomId ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-lg border border-primary/20 animate-bounce">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-headline text-on-surface">대화방을 생성해 보세요</h3>
              <p className="text-sm text-on-surface/50 max-w-sm mt-2">
                사이드바에서 원하는 질문 언어와 AI 답변 번역 언어를 설정하고 "새 대화 만들기" 버튼을 눌러 번역 채팅을 시작해 보세요!
              </p>
            </div>
          </div>
        ) : loadingMessages ? (
          <ChatSkeleton />
        ) : messages.length === 0 && !isStreaming ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 text-on-surface/50 space-y-2">
            <div className="text-4xl animate-bounce mb-2">
              {PERSONA_EMOJIS[room?.persona || "interpreter"]}
            </div>
            <p className="text-sm font-semibold">대화가 시작되었습니다!</p>
            <p className="text-xs text-on-surface/40">
              아래 입력창에 편하게 메시지를 보내면, 상대방이 설정된 언어로 자연스럽게 번역과 답변을 해줍니다.
            </p>
          </div>
        ) : (
          <>
            {/* Date divider tag */}
            <div className="flex justify-center">
              <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10 backdrop-blur-md">
                Conversation History
              </span>
            </div>

            {/* List existing messages */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full message-enter ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[85%] md:max-w-[70%] glass-bubble-user rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg relative border">
                    <p className="text-sm md:text-base text-white leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  <div className="flex space-x-2.5 max-w-[90%] md:max-w-[75%]">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 border border-primary/10 flex-shrink-0 flex items-center justify-center mt-1 shadow-sm text-sm">
                      {PERSONA_EMOJIS[room?.persona || "interpreter"]}
                    </div>
                    {(() => {
                      const { mainText, hoverTranslation, vocab } = parseContent(msg.content);
                      return (
                        <div className="glass-bubble-ai rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-lg relative border group/bubble cursor-help">
                          {/* Floating hover translation tooltip card */}
                          {hoverTranslation && (
                            <div className="absolute left-0 bottom-full mb-2 w-72 p-3 glass-panel rounded-xl shadow-xl border border-primary/10 opacity-0 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:pointer-events-auto transition-all duration-300 transform translate-y-2 group-hover/bubble:translate-y-0 z-50">
                              <div className="text-[10px] uppercase font-bold tracking-wider text-on-surface/40 mb-1 flex items-center gap-1">
                                <Globe className="w-3 h-3 text-primary/50" />
                                원문 번역 ({inputLangInfo.name})
                              </div>
                              <p className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap">
                                {hoverTranslation}
                              </p>
                            </div>
                          )}

                          {/* Translation layout container inside chat */}
                          <div className="bg-primary/5 rounded-xl p-3.5 border border-primary/10 mb-2 font-medium text-sm md:text-base leading-relaxed whitespace-pre-wrap text-on-surface">
                            {mainText}
                          </div>

                          {/* In-place Mobile Translation View */}
                          {toggledTranslations[msg.id] && hoverTranslation && (
                            <div className="bg-white/60 border border-primary/10 rounded-xl p-3.5 mb-2 w-full text-left message-enter">
                              <div className="text-[10px] uppercase font-bold tracking-wider text-primary mb-1 flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5 text-primary animate-pulse" />
                                원문 번역 ({inputLangInfo.name})
                              </div>
                              <p className="text-xs text-on-surface/85 leading-relaxed whitespace-pre-wrap">
                                {hoverTranslation}
                              </p>
                            </div>
                          )}

                          {/* Grounding metadata (Google Search) */}
                          {msg.groundingMetadata && (
                            <div className="mt-2.5 pt-2.5 border-t border-primary/5">
                              {/* Search Queries */}
                              {msg.groundingMetadata.webSearchQueries && msg.groundingMetadata.webSearchQueries.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface/40 flex items-center gap-1">
                                    <Globe className="w-3 h-3 text-primary/50" />
                                    검색어:
                                  </span>
                                  {msg.groundingMetadata.webSearchQueries.map((query, qIdx) => (
                                    <span key={qIdx} className="text-[11px] bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-medium border border-primary/5">
                                      {query}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Search Sources */}
                              {msg.groundingMetadata.groundingChunks && msg.groundingMetadata.groundingChunks.length > 0 && (
                                <div>
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-on-surface/40 mb-1.5 flex items-center gap-1">
                                    <Globe className="w-3.5 h-3.5 text-primary" />
                                    출처:
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {msg.groundingMetadata.groundingChunks
                                      .filter(chunk => chunk.web?.uri)
                                      .map((chunk, cIdx) => (
                                        <a
                                          key={cIdx}
                                          href={chunk.web.uri}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/70 hover:bg-primary text-[10.5px] text-on-surface/80 hover:text-white border border-primary/5 shadow-xs transition-all duration-300 group/link"
                                        >
                                          <span className="font-semibold truncate max-w-[140px] md:max-w-[180px]">
                                            {chunk.web.title || getHostname(chunk.web.uri)}
                                          </span>
                                          <span className="text-[9px] text-on-surface/40 group-hover/link:text-white/60">
                                            {getHostname(chunk.web.uri)}
                                          </span>
                                        </a>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center flex-nowrap space-x-3.5 mt-2 text-[11px] md:text-xs text-on-surface/50 whitespace-nowrap overflow-x-auto scrollbar-none">
                            <button
                              onClick={() => handleCopy(mainText)}
                              className="flex items-center space-x-1 hover:text-primary transition-colors cursor-pointer flex-shrink-0 py-0.5"
                              title="복사"
                            >
                              <Copy className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="hidden md:inline">복사</span>
                            </button>
                            <button
                              onClick={() => handleSpeak(msg.content, outputLangInfo.code, msg.id)}
                              className="flex items-center space-x-1 hover:text-primary transition-colors cursor-pointer flex-shrink-0 py-0.5"
                              title={speakingMessageId === msg.id ? "정지" : "읽기"}
                            >
                              <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="hidden md:inline">{speakingMessageId === msg.id ? "정지" : "읽기"}</span>
                            </button>
                            <button
                              onClick={() => setActiveVocabMsgId(activeVocabMsgId === msg.id ? null : msg.id)}
                              className={`flex items-center space-x-1 hover:text-primary transition-colors cursor-pointer flex-shrink-0 py-0.5 ${
                                activeVocabMsgId === msg.id ? "text-primary font-bold animate-pulse" : ""
                              }`}
                              title="단어 사전"
                            >
                              <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="hidden md:inline">단어 사전</span>
                            </button>
                            {hoverTranslation && (
                              <button
                                onClick={() => handleToggleTranslation(msg.id)}
                                className={`flex items-center space-x-1 hover:text-primary transition-colors cursor-pointer flex-shrink-0 py-0.5 ${
                                  toggledTranslations[msg.id] ? "text-primary font-bold" : ""
                                }`}
                                title={toggledTranslations[msg.id] ? "번역 숨기기" : "번역 보기"}
                              >
                                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="hidden md:inline">{toggledTranslations[msg.id] ? "번역 숨기기" : "번역 보기"}</span>
                              </button>
                            )}
                          </div>

                          {/* Vocabulary Guide Drawer Card */}
                          {activeVocabMsgId === msg.id && (
                            <div className="mt-3 pt-3.5 border-t border-primary/10 animate-fade-in w-full text-left">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-primary flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                                  핵심 단어장 & 발음 학습
                                </span>
                              </div>
                              
                              {vocab ? (
                                <div className="space-y-2 mt-2">
                                  {vocab.map((item, idx) => (
                                    <div 
                                      key={idx} 
                                      className="flex items-center justify-between bg-primary/5 hover:bg-primary/10 transition-colors p-2.5 rounded-xl border border-primary/5 text-xs text-on-surface"
                                    >
                                      <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
                                          <span className="font-bold text-sm text-on-surface font-headline leading-tight">
                                            {item.word}
                                          </span>
                                          {item.reading && (
                                            <span className="text-[10px] bg-primary-container text-on-primary-container font-medium px-1.5 py-0.2 rounded-full leading-normal">
                                              {item.reading}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-on-surface/75 mt-1 leading-normal flex-wrap">
                                          {item.meaning}
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center space-x-1 flex-shrink-0">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleVocab(item, outputLangInfo.code);
                                          }}
                                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                            savedVocabs.some(v => v.word === item.word && v.langCode === outputLangInfo.code)
                                              ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-600 border border-yellow-200"
                                              : "bg-white/60 hover:bg-primary/10 hover:text-primary text-on-surface/60 border border-primary/5"
                                          }`}
                                          title={
                                            savedVocabs.some(v => v.word === item.word && v.langCode === outputLangInfo.code)
                                              ? "단어장에서 제거"
                                              : "단어장에 추가"
                                          }
                                        >
                                          {savedVocabs.some(v => v.word === item.word && v.langCode === outputLangInfo.code) ? (
                                            <Star className="w-3.5 h-3.5 fill-current text-yellow-500" />
                                          ) : (
                                            <Star className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSpeakWord(item.word, outputLangInfo.code);
                                          }}
                                          className="p-1.5 rounded-lg bg-white/60 hover:bg-primary hover:text-white text-on-surface/60 border border-primary/5 transition-all cursor-pointer"
                                          title="단어 발음 듣기"
                                        >
                                          <Volume2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-3 text-center bg-primary/5 rounded-xl border border-primary/5">
                                  <p className="text-xs text-on-surface/50 mb-2">
                                    이 문장의 핵심 단어 데이터가 아직 없습니다.
                                  </p>
                                  {vocabErrorMsgId === msg.id && (
                                    <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200/50 rounded-xl text-left">
                                      <p className="text-xs text-red-600 font-semibold leading-relaxed">
                                        ⚠️ {vocabErrorText}
                                      </p>
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handleAnalyzeVocab(msg.id, msg.content, outputLangInfo.code)}
                                    disabled={loadingVocabMsgId === msg.id}
                                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-primary hover:bg-primary/95 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                                  >
                                    {loadingVocabMsgId === msg.id ? (
                                      <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>분석 중...</span>
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span>🔍 문장 단어 분석하기</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}

            {/* Streaming message chunk block */}
            {isStreaming && streamingResponse && (() => {
              const { mainText, hoverTranslation } = parseContent(streamingResponse);
              return (
                <div className="flex justify-start w-full message-enter">
                  <div className="flex space-x-2.5 max-w-[90%] md:max-w-[75%]">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 border border-primary/10 flex-shrink-0 flex items-center justify-center mt-1 shadow-sm text-sm">
                      {PERSONA_EMOJIS[room?.persona || "interpreter"]}
                    </div>
                    <div className="glass-bubble-ai rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-lg relative border group/bubble cursor-help">
                      {/* Floating hover translation tooltip card */}
                      {hoverTranslation && (
                        <div className="absolute left-0 bottom-full mb-2 w-72 p-3 glass-panel rounded-xl shadow-xl border border-primary/10 opacity-0 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:pointer-events-auto transition-all duration-300 transform translate-y-2 group-hover/bubble:translate-y-0 z-50">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-on-surface/40 mb-1 flex items-center gap-1">
                            <Globe className="w-3 h-3 text-primary/50" />
                            원문 번역 ({inputLangInfo.name})
                          </div>
                          <p className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap">
                            {hoverTranslation}
                          </p>
                        </div>
                      )}

                      <div className="bg-primary/5 rounded-xl p-3.5 border border-primary/10 mb-2 font-medium text-sm md:text-base leading-relaxed whitespace-pre-wrap text-on-surface min-h-[30px]">
                        {mainText}
                      </div>

                      {/* Streaming Grounding metadata (Google Search) */}
                      {currentGroundingMetadata && (
                        <div className="mt-2.5 pt-2.5 border-t border-primary/5">
                          {/* Search Queries */}
                          {currentGroundingMetadata.webSearchQueries && currentGroundingMetadata.webSearchQueries.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface/40 flex items-center gap-1">
                                <Globe className="w-3 h-3 text-primary/50" />
                                검색어:
                              </span>
                              {currentGroundingMetadata.webSearchQueries.map((query, qIdx) => (
                                <span key={qIdx} className="text-[11px] bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-medium border border-primary/5">
                                  {query}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Search Sources */}
                          {currentGroundingMetadata.groundingChunks && currentGroundingMetadata.groundingChunks.length > 0 && (
                            <div>
                              <div className="text-[10px] uppercase font-bold tracking-wider text-on-surface/40 mb-1.5 flex items-center gap-1">
                                <Globe className="w-3 h-3 text-primary/50" />
                                출처:
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {currentGroundingMetadata.groundingChunks
                                  .filter(chunk => chunk.web?.uri)
                                  .map((chunk, cIdx) => (
                                    <a
                                      key={cIdx}
                                      href={chunk.web.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/70 hover:bg-primary text-[10.5px] text-on-surface/80 hover:text-white border border-primary/5 shadow-xs transition-all duration-300 group/link"
                                    >
                                      <span className="font-semibold truncate max-w-[140px] md:max-w-[180px]">
                                        {chunk.web.title || getHostname(chunk.web.uri)}
                                      </span>
                                      <span className="text-[9px] text-on-surface/40 group-hover/link:text-white/60">
                                        {getHostname(chunk.web.uri)}
                                      </span>
                                    </a>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Pulsing Loading typing state */}
            {isStreaming && !streamingResponse && (
              <div className="flex justify-start w-full message-enter">
                <div className="flex space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 border border-primary/10 flex-shrink-0 flex items-center justify-center mt-1 shadow-sm text-sm animate-pulse">
                    {PERSONA_EMOJIS[room?.persona || "interpreter"]}
                  </div>
                  <div className="glass-bubble-ai rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-lg flex items-center space-x-1.5 h-[44px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/80 typing-dot"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/80 typing-dot"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/80 typing-dot"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="flex items-center space-x-2 text-red-800 bg-red-50 border border-red-200/50 p-4 rounded-2xl text-sm max-w-2xl mx-auto message-enter">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}
          </>
        )}
        {/* Spacer to prevent Safari/WebKit flex scroll padding-bottom bug and clear bottom input area */}
        <div className="h-44 md:h-52 flex-shrink-0 pointer-events-none" />
        <div ref={chatEndRef} />
      </div>

      {/* Input Message Area */}
      {activeRoomId && activeRoomId !== "vocab" && (
        <div className="absolute bottom-0 w-full p-4 md:p-6 bg-gradient-to-t from-[#f8f7fb] via-[#f8f7fb]/95 to-transparent">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto relative group">
            {/* Pulsing backdrop glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-primary-container/10 to-primary/10 rounded-2xl blur-lg opacity-40 group-hover:opacity-75 transition duration-500"></div>
            <div className="relative glass-panel rounded-2xl flex items-end p-2.5 md:p-3 border-primary/10 focus-within:border-primary/45 focus-within:bg-white/80 transition-all duration-300 shadow-sm">
              <textarea
                ref={textareaRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    if (e.nativeEvent.isComposing) return;
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                rows={1}
                placeholder={`${inputLangInfo.name}으로 메시지를 작성해 보세요... (${outputLangInfo.name}(으)로 답변 예정)`}
                className="w-full bg-transparent border-none text-on-surface text-sm md:text-base focus:ring-0 resize-none py-2.5 placeholder-on-surface/40 focus:outline-none pl-2"
              />
              <button
                type="submit"
                disabled={!userInput.trim() || isStreaming}
                className="p-3 ml-2 rounded-xl bg-primary text-white hover:bg-primary-container hover:text-primary transition-all duration-300 shadow-[0_4px_12px_rgba(24,24,27,0.15)] hover-pulse-glow flex-shrink-0 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center mt-2.5">
              <p className="text-[10px] text-on-surface/40 font-semibold uppercase tracking-widest">
                SUEAAZ Multilingual Chat System
              </p>
            </div>
          </form>
        </div>
      )}
      {/* High-Quality Voice Guide Modal */}
      {showVoiceGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 bg-white/95 shadow-2xl rounded-2xl border border-primary/10 relative text-on-surface">
            <button
              onClick={() => setShowVoiceGuide(false)}
              className="absolute top-4 right-4 text-on-surface/60 hover:text-on-surface font-semibold text-lg cursor-pointer"
            >
              ✕
            </button>
            <div className="flex items-center space-x-2.5 mb-4">
              <Volume2 className="w-5 h-5 text-primary" />
              <h3 className="text-base font-bold font-headline">자연스러운 목소리(고품질 TTS) 설정 안내</h3>
            </div>
            <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-on-surface/80">
              <p>
                사용하시는 기기(macOS, iOS, Windows) 및 브라우저 환경에 따라 선택할 수 있는 목소리와 음질이 다릅니다. 기본 제공되는 목소리가 기계처럼 딱딱하게 느껴진다면 아래 해결법을 시도해 보세요!
              </p>
              
              <div className="bg-primary/5 p-3.5 rounded-xl border border-primary/10 space-y-2">
                <h4 className="font-bold text-primary flex items-center text-xs">
                  <span className="mr-1.5">🌐</span> Google Chrome(크롬) 브라우저 접속 권장
                </h4>
                <p className="text-xs text-on-surface/75">
                  크롬 브라우저에서는 별도의 복잡한 설치 없이도 매우 부드럽고 생생한 온라인 <strong>'구글(Google) 신경망 고품질 음성'</strong>을 드롭다운에서 선택하여 바로 낭독을 들으실 수 있습니다.
                </p>
              </div>

              <div className="bg-primary/5 p-3.5 rounded-xl border border-primary/10 space-y-2">
                <h4 className="font-bold text-primary flex items-center text-xs">
                  <span className="mr-1.5">💻</span> macOS / Safari(사파리) 사용자 음성 활성화
                </h4>
                <p className="text-xs text-on-surface/75">
                  애플 macOS는 저장 공간 절약을 위해 기본적으로 용량이 적고 딱딱한 <strong>'로봇 음성(Compact)'</strong>만 다운로드해 둡니다. 아래 단계를 통해 고해상도 시리(Siri)/고품질 음성을 바로 다운로드하실 수 있습니다.
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-on-surface/70">
                  <li><strong>시스템 설정</strong> ➔ <strong>손쉬운 사용(Accessibility)</strong> ➔ <strong>말하기 콘텐츠(Spoken Content)</strong>로 이동합니다.</li>
                  <li><strong>시스템 음성(System Speech Voice)</strong> 우측 드롭다운을 열어 <strong>'음성 관리(Manage Voices...)'</strong>를 선택합니다.</li>
                  <li>사용할 언어(예: 한국어 - Yuna, 일본어 - Otoya/Kyoko, 영어 - Samantha/Siri 등)를 고르고 <strong>'고품질(Enhanced)'</strong> 또는 <strong>'시리(Siri)'</strong> 목소리의 다운로드 아이콘을 누릅니다.</li>
                  <li>다운로드가 완료되면 브라우저를 새로고침(F5)하고 헤더 드롭다운에서 새 목소리를 골라주세요!</li>
                </ol>
              </div>
            </div>
            
            <button
              onClick={() => setShowVoiceGuide(false)}
              className="mt-6 w-full py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
