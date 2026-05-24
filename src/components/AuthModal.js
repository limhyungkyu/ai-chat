"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { Sparkles, AlertCircle } from "lucide-react";

export default function AuthModal({ isOpen, onClose }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isMobileDevice = () => {
    if (typeof window === "undefined") return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      if (isMobileDevice()) {
        await signInWithRedirect(auth, provider);
        // Note: The page will redirect away. No need to reset loading or close modal here.
      } else {
        await signInWithPopup(auth, provider);
        onClose();
      }
    } catch (err) {
      console.error("Google sign-in error:", err);

      // Show user-friendly message with error code for debugging
      const code = err.code || "unknown";

      if (code === "auth/popup-closed-by-user") {
        setError("로그인 팝업이 닫혔습니다. 다시 시도해 주세요.");
      } else if (code === "auth/popup-blocked") {
        setError(
          "브라우저가 팝업을 차단했습니다. 설정에서 이 사이트의 팝업을 허용한 뒤 다시 시도해 주세요."
        );
      } else if (code === "auth/cancelled-popup-request") {
        setError("이전 로그인 요청이 취소되었습니다. 다시 시도해 주세요.");
      } else if (code === "auth/operation-not-allowed") {
        setError(
          "Google 로그인이 비활성화되어 있습니다. 관리자에게 문의해 주세요."
        );
      } else if (code === "auth/unauthorized-domain") {
        setError(
          `이 도메인이 Firebase 승인 도메인 목록에 없습니다. [${code}]`
        );
      } else {
        setError(`로그인 에러: ${err.message || code} [${code}]`);
      }
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-sm overflow-hidden glass-panel rounded-2xl p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] message-enter border border-primary/10">
        {/* Glow backdrop decorative */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary-container/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex flex-col items-center mb-8 relative">
          <div className="relative mb-3 group/logo">
            <div className="absolute inset-0 bg-primary/25 rounded-2xl blur-md group-hover/logo:blur-lg transition-all duration-300 pointer-events-none"></div>
            <img
              src="/logo.png"
              alt="SUEAAZ Logo"
              className="w-12 h-12 rounded-2xl relative z-10 border border-white/20 shadow-lg group-hover/logo:scale-105 transition-transform duration-300 select-none"
            />
          </div>
          <h2 className="text-2xl font-bold font-headline bg-gradient-to-br from-primary to-primary-container bg-clip-text text-transparent">
            SUEAAZ AI Chat
          </h2>
          <p className="text-xs text-on-surface/60 mt-1.5 text-center">
            실시간 다국어 AI 대화를 동기화하고 보존하기 위해 로그인을 진행해 주세요.
          </p>
        </div>

        {/* Action Panel */}
        <div className="space-y-4 relative">
          {error && (
            <div className="flex items-start space-x-2 text-red-800 bg-red-50 border border-red-200/50 p-3.5 rounded-xl text-xs leading-relaxed">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
              <span className="break-all">{error}</span>
            </div>
          )}

          {/* Premium Google Sign-In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-4 px-4 rounded-xl bg-white/60 border border-primary/15 text-on-surface font-headline font-semibold flex items-center justify-center space-x-3 transition-all duration-300 hover:bg-primary/10 hover:border-primary/20 hover:text-primary shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(24,24,27,0.08)] cursor-pointer group disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></span>
            ) : (
              <>
                {/* SVG Google Custom Logo icon */}
                <svg
                  className="w-5 h-5 group-hover:scale-110 transition-transform duration-300"
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                >
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 7.99 12.5a5.99 5.99 0 0 1 6.002-6.013c2.474 0 4.502 1.488 5.342 3.593l3.652-2.13C20.89 3.6 16.892 1.5 12.24 1.5 6.046 1.5 1.5 7.046 1.5 13.25s4.546 11.75 10.74 11.75c6.262 0 10.597-4.4 10.597-10.716 0-.616-.057-1.218-.16-1.785l-10.437-.214Z"
                  />
                  <path
                    fill="#4285F4"
                    d="M22.677 12.285c0-.616-.057-1.218-.16-1.785H12.24v4.114h6.887a7.22 7.22 0 0 1-1.393 2.923l3.228 2.505c2.148-1.983 3.65-4.897 3.65-8.757Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12.24 23.5c3.297 0 6.066-1.093 8.087-2.968l-3.228-2.505c-1.05.703-2.428 1.123-4.859 1.123-3.864 0-7.143-2.613-8.31-6.136L.266 15.65c2.378 4.7 7.218 7.85 12.974 7.85Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.93 13.014a7.037 7.037 0 0 1 0-4.028L.266 6.856A11.96 11.96 0 0 0 .01 12.5c0 1.986.48 3.864 1.332 5.534l2.588-3.02Z"
                  />
                </svg>
                <span>Google 계정으로 계속하기</span>
              </>
            )}
          </button>
        </div>

        {/* Footer info text */}
        <div className="text-center mt-8 text-[10px] text-on-surface/40 leading-relaxed relative">
          소셜 로그인을 계속함으로써 서비스 약관 및 개인정보 처리방침에 동의하게 됩니다.
        </div>
      </div>
    </div>
  );
}
