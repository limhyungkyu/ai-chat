"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/languages";
import { Plus, MessageSquare, LogOut, Globe, Sparkles, ChevronRight, Settings, BookOpen } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore";

const PERSONAS = [
  { code: "interpreter", name: "💼 전문 통역사", desc: "정중하고 비즈니스 매너가 돋보이는 격식 있는 어조" },
  { code: "buddy", name: "⚡ 친근한 친구", desc: "캐주얼한 일상 대화체(반말/반존대)와 이모지 사용" },
  { code: "guide", name: "🧭 여행 가이드", desc: "활기찬 안내 톤과 현지 문화/장소에 대한 팁 추가" },
  { code: "mentor", name: "🎓 요약 멘토", desc: "설명이 명쾌하고 패턴 위주로 짧게 짚어주는 코칭 스타일" },
  { code: "empath", name: "🌿 공감 동반자", desc: "세심한 공감과 따뜻한 위로의 문장으로 마음을 치유" }
];

const LANGUAGE_LEVELS = [
  { code: "beginner", name: "🌱 초급", desc: "단문 위주, 쉬운 단어와 친절한 호흡" },
  { code: "intermediate", name: "🍀 중급", desc: "다양한 실용 어휘를 섞은 일상 회화 수준" },
  { code: "advanced", name: "🔥 원어민/고급", desc: "생생한 이디엄, 슬랭, 자연스러운 구어체 무제한" }
];

export default function Sidebar({
  user,
  rooms,
  activeRoomId,
  setActiveRoomId,
  onOpenAuth,
  loadingRooms,
  className = ""
}) {
  const [inputLangCode, setInputLangCode] = useState("ko");
  const [outputLangCode, setOutputLangCode] = useState("ja");
  const [persona, setPersona] = useState("interpreter");
  const [languageLevel, setLanguageLevel] = useState("advanced");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const inputLang = LANGUAGES.find((l) => l.code === inputLangCode) || LANGUAGES[0];
  const outputLang = LANGUAGES.find((l) => l.code === outputLangCode) || LANGUAGES[1];

  const handleCreateRoom = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    setIsCreatingRoom(true);
    try {
      const titlePrefix = {
        interpreter: "전문 통역사",
        buddy: "친근한 친구",
        guide: "현지 여행 가이드",
        mentor: "핵심 요약 멘토",
        empath: "따스한 동반자"
      };
      const roomTitle = `${outputLang.flag} ${outputLang.name} ${titlePrefix[persona] || "대화 상대"}`;
      
      await addDoc(collection(db, "rooms"), {
        userId: user.uid,
        title: roomTitle,
        inputLang: inputLangCode,
        outputLang: outputLangCode,
        persona: persona,
        languageLevel: languageLevel,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error creating room:", error);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setActiveRoomId(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <nav className={`flex flex-col text-on-surface h-full overflow-hidden ${className}`}>
      {/* Brand Header */}
      <div className="flex items-center space-x-3 px-2 mb-6">
        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center shadow-lg shadow-primary/20">
          <Sparkles className="text-white w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-headline bg-gradient-to-br from-primary to-primary-container bg-clip-text text-transparent tracking-tight">
            SUEAAZ AI
          </h1>
          <p className="text-[10px] text-on-surface/50 font-bold uppercase tracking-widest">
            v2.4 Glass Edition
          </p>
        </div>
      </div>

      {/* Language Selection controls */}
      <div className="space-y-3 px-2 py-3 rounded-2xl glass-panel bg-white/40">
        <p className="text-[10px] uppercase tracking-widest text-primary font-bold">
          대화 상대방 설정
        </p>

        {/* Input Language Dropdown */}
        <div className="space-y-1">
          <label className="text-[10px] text-on-surface/40 font-semibold ml-1">내가 사용할 언어</label>
          <div className="relative">
            <select
              value={inputLangCode}
              onChange={(e) => setInputLangCode(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-white/50 border border-primary/10 text-on-surface text-sm focus:outline-none focus:border-primary/50 transition-colors cursor-pointer appearance-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-white text-on-surface">
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-on-surface/40">
              <ChevronRight className="w-4 h-4 rotate-90" />
            </span>
          </div>
        </div>

        {/* Arrow Transition */}
        <div className="flex justify-center -my-1">
          <div className="bg-white rounded-full p-1 border border-primary/10 text-primary shadow-sm">
            <Globe className="w-4 h-4 animate-spin-slow" />
          </div>
        </div>

        {/* Output Language Dropdown */}
        <div className="space-y-1">
          <label className="text-[10px] text-on-surface/40 font-semibold ml-1">상대방이 사용할 언어</label>
          <div className="relative">
            <select
              value={outputLangCode}
              onChange={(e) => setOutputLangCode(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-white/50 border border-primary/10 text-on-surface text-sm focus:outline-none focus:border-primary/50 transition-colors cursor-pointer appearance-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-white text-on-surface">
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-on-surface/40">
              <ChevronRight className="w-4 h-4 rotate-90" />
            </span>
          </div>
        </div>

        {/* Separator line & Advanced settings */}
        <div className="border-t border-primary/5 pt-3 mt-3 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold">
            대화 상대 성향 & 유창성 설정
          </p>

          {/* Persona Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] text-on-surface/40 font-semibold ml-1">대화 상대 성격</label>
            <div className="relative">
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-white/50 border border-primary/10 text-on-surface text-sm focus:outline-none focus:border-primary/50 transition-colors cursor-pointer appearance-none font-medium"
              >
                {PERSONAS.map((p) => (
                  <option key={p.code} value={p.code} className="bg-white text-on-surface" title={p.desc}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-on-surface/40">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </span>
            </div>
            <p className="text-[9px] text-on-surface/45 pl-1 leading-normal">
              {PERSONAS.find(p => p.code === persona)?.desc}
            </p>
          </div>

          {/* Language Level Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] text-on-surface/40 font-semibold ml-1">상대방의 언어 유창성</label>
            <div className="relative">
              <select
                value={languageLevel}
                onChange={(e) => setLanguageLevel(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-white/50 border border-primary/10 text-on-surface text-sm focus:outline-none focus:border-primary/50 transition-colors cursor-pointer appearance-none font-medium"
              >
                {LANGUAGE_LEVELS.map((lvl) => (
                  <option key={lvl.code} value={lvl.code} className="bg-white text-on-surface" title={lvl.desc}>
                    {lvl.name}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-on-surface/40">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </span>
            </div>
            <p className="text-[9px] text-on-surface/45 pl-1 leading-normal">
              {LANGUAGE_LEVELS.find(lvl => lvl.code === languageLevel)?.desc}
            </p>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <button
        onClick={handleCreateRoom}
        disabled={isCreatingRoom}
        className="w-full mt-4 py-3 px-4 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary font-headline font-semibold flex items-center justify-center space-x-2 transition-all duration-300 border border-primary/30 shadow-[0_0_12px_rgba(24,24,27,0.05)] group hover:shadow-[0_0_20px_rgba(24,24,27,0.1)] cursor-pointer disabled:opacity-50"
      >
        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
        <span>새 대화 만들기</span>
      </button>

      {/* 내 단어장 바로가기 버튼 */}
      {user && (
        <button
          onClick={() => setActiveRoomId("vocab")}
          className={`w-full mt-2 py-3 px-4 rounded-xl font-headline font-semibold flex items-center justify-center space-x-2 transition-all duration-300 border cursor-pointer ${
            activeRoomId === "vocab"
              ? "bg-primary text-white border-primary shadow-[0_4px_16px_rgba(124,58,237,0.25)]"
              : "bg-white/40 hover:bg-primary/10 text-on-surface hover:text-primary border-primary/10"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>📝 내 단어장</span>
        </button>
      )}

      {/* Navigation Rooms Area */}
      <div className="flex-1 overflow-y-auto space-y-1.5 mt-6 px-1">
        <p className="text-[10px] uppercase tracking-widest text-on-surface/40 font-bold mb-3">
          채팅방 목록
        </p>

        {loadingRooms ? (
          <div className="space-y-2">
            <div className="h-10 w-full rounded-xl bg-primary/5 shimmer"></div>
            <div className="h-10 w-full rounded-xl bg-primary/5 shimmer"></div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-8 text-xs text-on-surface/30">
            {user ? "대화 기록이 없습니다.\n새 대화를 만들어 보세요!" : "로그인하면 대화 기록이 연동됩니다."}
          </div>
        ) : (
          rooms.map((room) => {
            const isActive = activeRoomId === room.id;
            return (
              <button
                key={room.id}
                onClick={() => setActiveRoomId(room.id)}
                className={`flex items-center space-x-3 px-3 py-3 w-full rounded-xl transition-all duration-300 text-left font-body group hover:translate-x-1 ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/15 shadow-[0_4px_12px_rgba(124,58,237,0.05)]"
                    : "text-on-surface/65 hover:bg-primary/5 hover:text-primary"
                }`}
              >
                <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : "text-on-surface/40 group-hover:text-primary/70"}`} />
                <span className="font-medium text-sm truncate flex-1">{room.title}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_rgba(24,24,27,0.4)]"></span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer / Profile Section */}
      <div className="mt-auto space-y-2 border-t border-primary/10 pt-4">
        {user ? (
          <div className="flex items-center space-x-3 px-2 py-1.5">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-primary-container border border-white/20 flex items-center justify-center text-white font-bold text-sm">
                {user.email ? user.email[0].toUpperCase() : "U"}
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-surface"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-on-surface/80 font-semibold truncate">
                {user.email || "사용자"}
              </p>
              <button
                onClick={handleLogout}
                className="text-[10px] text-red-500 hover:text-red-400 font-bold flex items-center space-x-1 mt-0.5 cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full py-2.5 px-4 rounded-xl bg-white/40 hover:bg-primary/10 text-on-surface hover:text-primary text-sm font-semibold flex items-center justify-center space-x-2 transition-all duration-300 border border-primary/10 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span>로그인 / 회원가입</span>
          </button>
        )}

        {/* Service Version */}
        <div className="text-center pt-2 pb-1">
          <p className="text-[9px] font-bold tracking-widest text-on-surface/30 uppercase select-none">
            Service Version 0.1.2
          </p>
        </div>
      </div>
    </nav>
  );
}
