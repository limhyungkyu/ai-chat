"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, getRedirectResult } from "firebase/auth";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import AuthModal from "@/components/AuthModal";
import { X } from "lucide-react";

export default function Home() {
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
      if (!firebaseUser) {
        setRooms([]);
        setActiveRoomId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle mobile redirect sign-in result on mount
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Successfully logged in via redirect:", result.user);
        }
      })
      .catch((err) => {
        console.error("Redirect sign-in error:", err);
      });
  }, []);

  // Monitor rooms collection in real-time
  useEffect(() => {
    if (!user) return;

    setLoadingRooms(true);
    const roomsQuery = query(
      collection(db, "rooms"),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
      const fetchedRooms = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setRooms(fetchedRooms);
      setLoadingRooms(false);

      // Auto-select first room if none is selected
      if (fetchedRooms.length > 0 && !activeRoomId) {
        setActiveRoomId(fetchedRooms[0].id);
      }
    }, (error) => {
      console.error("Error loading rooms:", error);
      setLoadingRooms(false);
    });

    return () => unsubscribe();
  }, [user, activeRoomId]);

  // Particle background effects
  useEffect(() => {
    const canvas = document.getElementById("particlesCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let particles = [];
    let animationFrameId;

    const initParticles = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < 40; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.5 + 0.5,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          alpha: Math.random() * 0.4 + 0.1,
        });
      }
    };

    const animateParticles = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 120, 120, ${p.alpha * 0.7})`;
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(animateParticles);
    };

    window.addEventListener("resize", initParticles);
    initParticles();
    animateParticles();

    return () => {
      window.removeEventListener("resize", initParticles);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative flex flex-row h-full w-full overflow-hidden font-body text-on-surface">
      {/* Background canvas */}
      <canvas id="particlesCanvas" className="fixed inset-0 pointer-events-none z-0" />

      {/* Desktop Sidebar Layout */}
      <div className="hidden md:block fixed left-0 top-0 h-full w-72 z-40 bg-surface/10 backdrop-blur-2xl rounded-r-xl border-r border-primary/10 shadow-[10px_0_40px_rgba(0,0,0,0.03)] overflow-hidden">
        <Sidebar
          user={user}
          rooms={rooms}
          activeRoomId={activeRoomId}
          setActiveRoomId={setActiveRoomId}
          onOpenAuth={() => setAuthModalOpen(true)}
          loadingRooms={loadingRooms}
          className="h-full p-4"
        />
      </div>

      {/* Mobile Slide Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Overlay */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer content wrapper */}
          <div className="relative w-72 h-full z-10 flex flex-col p-4 bg-surface border-r border-primary/10 shadow-[10px_0_40px_rgba(0,0,0,0.06)] animate-slide-right overflow-hidden">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/60 hover:bg-primary/10 text-on-surface cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <Sidebar
              user={user}
              rooms={rooms}
              activeRoomId={activeRoomId}
              setActiveRoomId={(id) => {
                setActiveRoomId(id);
                setMobileMenuOpen(false);
              }}
              onOpenAuth={() => {
                setAuthModalOpen(true);
                setMobileMenuOpen(false);
              }}
              loadingRooms={loadingRooms}
              className="flex-1 min-h-0 mt-8 w-full"
            />
          </div>
        </div>
      )}

      {/* Main Chat Canvas Layout */}
      <ChatArea
        user={user}
        activeRoomId={activeRoomId}
        onOpenAuth={() => setAuthModalOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
      />

      {/* Auth Modal Container */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
