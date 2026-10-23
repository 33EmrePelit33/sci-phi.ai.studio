import React from 'react';

interface ArticleIllustrationProps {
  slug: string;
  category?: string;
  title?: string;
  className?: string;
  variant?: 'banner' | 'thumbnail';
}

export const ArticleIllustration: React.FC<ArticleIllustrationProps> = ({
  slug,
  category = 'fizik-kozmoloji',
  title = '',
  className = '',
  variant = 'banner'
}) => {
  const isThumbnail = variant === 'thumbnail';
  const cleanTitle = title.length > 40 ? title.slice(0, 38) + '...' : title;

  // Specific bespoke hand-crafted illustrations for signature articles
  if (slug.includes('blok-evren') || slug.includes('block-universe')) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-amber-500/20 group ${className}`}>
        <svg viewBox="0 0 800 450" className="w-full h-full object-cover transform group-hover:scale-102 transition-transform duration-700">
          <defs>
            <linearGradient id="bgGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#020617" />
              <stop offset="50%" stopColor="#0b1329" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </linearGradient>
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="800" height="450" fill="url(#bgGrad1)" />
          <circle cx="400" cy="225" r="240" fill="url(#centerGlow)" />
          <g stroke="#38bdf8" strokeWidth="1.2" opacity="0.4" fill="none">
            <polygon points="260,110 540,110 540,310 260,310" strokeDasharray="3 3" />
            <polygon points="200,160 480,160 480,360 200,360" stroke="#38bdf8" strokeWidth="1.6" />
            <line x1="200" y1="160" x2="260" y2="110" />
            <line x1="480" y1="160" x2="540" y2="110" />
            <line x1="480" y1="360" x2="540" y2="310" />
            <line x1="200" y1="360" x2="260" y2="310" />
          </g>
          <polygon points="400,225 300,340 500,340" fill="#38bdf8" fillOpacity="0.12" stroke="#38bdf8" strokeWidth="1.4" />
          <ellipse cx="400" cy="340" rx="100" ry="20" fill="#0284c7" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="1.2" />
          <polygon points="400,225 300,110 500,110" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1.4" />
          <ellipse cx="400" cy="110" rx="100" ry="20" fill="#d97706" fillOpacity="0.18" stroke="#f59e0b" strokeWidth="1.2" />
          <circle cx="400" cy="225" r="7" fill="#fbbf24" stroke="#ffffff" strokeWidth="2" />
          <line x1="120" y1="270" x2="680" y2="180" stroke="#ec4899" strokeWidth="2" strokeDasharray="6 3" />
          {!isThumbnail && (
            <g fill="#e2e8f0" fontSize="12" fontFamily="monospace" fontWeight="bold">
              <text x="415" y="222" fill="#fbbf24">ŞİMDİ (Now: t=0)</text>
              <text x="515" y="115" fill="#f59e0b">Gelecek Işık Konisi</text>
              <text x="515" y="345" fill="#38bdf8">Geçmiş Işık Konisi</text>
            </g>
          )}
        </svg>
        <div className="absolute bottom-2 right-3 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-amber-400 border border-amber-500/30">
          4D Spacetime Block
        </div>
      </div>
    );
  }

  if (slug.includes('solucan') || slug.includes('wormhole')) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-amber-500/20 group ${className}`}>
        <svg viewBox="0 0 800 450" className="w-full h-full object-cover transform group-hover:scale-102 transition-transform duration-700">
          <defs>
            <linearGradient id="wormGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#030712" />
              <stop offset="50%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <radialGradient id="wormHoleGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#6366f1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#030712" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="800" height="450" fill="url(#wormGrad)" />
          {/* Gravitational grid warped towards neck */}
          <path d="M 100 80 Q 400 220, 700 80" stroke="#38bdf8" strokeWidth="1" fill="none" opacity="0.4" />
          <path d="M 100 130 Q 400 225, 700 130" stroke="#38bdf8" strokeWidth="1" fill="none" opacity="0.5" />
          <path d="M 100 370 Q 400 225, 700 370" stroke="#38bdf8" strokeWidth="1" fill="none" opacity="0.4" />
          <path d="M 100 320 Q 400 220, 700 320" stroke="#38bdf8" strokeWidth="1" fill="none" opacity="0.5" />
          {/* Wormhole Throat */}
          <ellipse cx="400" cy="225" rx="140" ry="40" fill="url(#wormHoleGlow)" stroke="#f59e0b" strokeWidth="2.5" />
          <ellipse cx="400" cy="225" rx="80" ry="20" fill="#020617" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Tunnel Lines */}
          <line x1="320" y1="225" x2="480" y2="225" stroke="#fbbf24" strokeWidth="2" strokeDasharray="3 3" />
          {!isThumbnail && (
            <text x="400" y="300" fill="#fde68a" fontSize="12" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              Morris-Thorne Boğazı (Traversable Throat)
            </text>
          )}
        </svg>
        <div className="absolute bottom-2 right-3 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-amber-400 border border-amber-500/30">
          Wormhole Geometry
        </div>
      </div>
    );
  }

  if (slug.includes('cin-odasi') || slug.includes('chinese-room')) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-amber-500/20 group ${className}`}>
        <svg viewBox="0 0 800 450" className="w-full h-full object-cover transform group-hover:scale-102 transition-transform duration-700">
          <rect width="800" height="450" fill="#090d16" />
          <rect x="220" y="60" width="360" height="330" rx="16" fill="#0f172a" stroke="#d97706" strokeWidth="2.5" />
          <rect x="150" y="195" width="90" height="40" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
          <text x="195" y="220" fill="#38bdf8" fontSize="15" fontWeight="bold" textAnchor="middle">你叫什么?</text>
          <rect x="560" y="195" width="90" height="40" rx="8" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
          <text x="605" y="220" fill="#10b981" fontSize="15" fontWeight="bold" textAnchor="middle">我是思考者</text>
          <circle cx="400" cy="180" r="22" fill="#cbd5e1" opacity="0.85" />
          <path d="M 370 240 C 370 208, 430 208, 430 240 Z" fill="#64748b" opacity="0.9" />
          <text x="400" y="155" fill="#f59e0b" fontSize="24" fontWeight="bold" textAnchor="middle">?</text>
          <rect x="260" y="280" width="280" height="65" rx="8" fill="#020617" stroke="#d97706" strokeWidth="1" />
          <text x="400" y="315" fill="#fde68a" fontSize="11" fontFamily="monospace" textAnchor="middle">
            SENTAKS KURALI: [A] ➔ [B] (Anlama: %0)
          </text>
        </svg>
        <div className="absolute bottom-2 right-3 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-amber-400 border border-amber-500/30">
          Searle's Chinese Room
        </div>
      </div>
    );
  }

  if (slug.includes('kuantum') || slug.includes('quantum') || slug.includes('entangle')) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-amber-500/20 group ${className}`}>
        <svg viewBox="0 0 800 450" className="w-full h-full object-cover transform group-hover:scale-102 transition-transform duration-700">
          <rect width="800" height="450" fill="#050814" />
          <path d="M 220 225 C 310 160, 370 290, 400 225 C 430 160, 490 290, 580 225" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray="6 3" />
          <circle cx="220" cy="225" r="14" fill="#38bdf8" stroke="#ffffff" strokeWidth="2.5" />
          <line x1="220" y1="225" x2="220" y2="160" stroke="#ffffff" strokeWidth="3.5" />
          <polygon points="220,150 213,165 227,165" fill="#ffffff" />
          <circle cx="580" cy="225" r="14" fill="#ec4899" stroke="#ffffff" strokeWidth="2.5" />
          <line x1="580" y1="225" x2="580" y2="290" stroke="#ffffff" strokeWidth="3.5" />
          <polygon points="580,300 573,285 587,285" fill="#ffffff" />
          {!isThumbnail && (
            <text x="400" y="90" fill="#fbbf24" fontSize="13" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              Bell Kuantum Dolanıklığı: |S| = 2√2
            </text>
          )}
        </svg>
        <div className="absolute bottom-2 right-3 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-amber-400 border border-amber-500/30">
          Quantum Non-Locality
        </div>
      </div>
    );
  }

  // Category-based dynamic aesthetic visualizations for all 294 articles
  if (category === 'zihin-bilinc') {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-amber-500/20 group ${className}`}>
        <svg viewBox="0 0 800 450" className="w-full h-full object-cover transform group-hover:scale-102 transition-transform duration-700">
          <defs>
            <linearGradient id="mindBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#080214" />
              <stop offset="60%" stopColor="#140727" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>
          <rect width="800" height="450" fill="url(#mindBg)" />
          {/* Neural Synapse Web */}
          <g stroke="#a855f7" strokeWidth="1" opacity="0.4">
            <line x1="180" y1="160" x2="260" y2="220" />
            <line x1="260" y1="220" x2="360" y2="170" />
            <line x1="360" y1="170" x2="440" y2="250" />
            <line x1="440" y1="250" x2="540" y2="190" />
            <line x1="540" y1="190" x2="620" y2="270" />
            <circle cx="180" cy="160" r="4" fill="#ec4899" />
            <circle cx="260" cy="220" r="5" fill="#fbbf24" />
            <circle cx="360" cy="170" r="4" fill="#38bdf8" />
            <circle cx="440" cy="250" r="6" fill="#a855f7" />
            <circle cx="540" cy="190" r="4" fill="#ec4899" />
            <circle cx="620" cy="270" r="5" fill="#38bdf8" />
          </g>
          {/* Central Qualia / Mind Emblem */}
          <circle cx="400" cy="225" r="70" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.7" strokeDasharray="4 2" />
          <circle cx="400" cy="225" r="45" fill="#1e1b4b" stroke="#ec4899" strokeWidth="2" />
          <text x="400" y="232" fill="#fbbf24" fontSize="22" fontWeight="bold" fontFamily="serif" textAnchor="middle">Ψ</text>
          {!isThumbnail && cleanTitle && (
            <text x="400" y="360" fill="#e2e8f0" fontSize="13" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              {cleanTitle}
            </text>
          )}
        </svg>
        <div className="absolute bottom-2 right-3 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-pink-400 border border-pink-500/30">
          Zihin & Bilinç (Qualia)
        </div>
      </div>
    );
  }

  if (category === 'diyalektik-mantik') {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-amber-500/20 group ${className}`}>
        <svg viewBox="0 0 800 450" className="w-full h-full object-cover transform group-hover:scale-102 transition-transform duration-700">
          <defs>
            <linearGradient id="dialBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a0b05" />
              <stop offset="60%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>
          <rect width="800" height="450" fill="url(#dialBg)" />
          {/* Interlocking Golden Spiral & Gears */}
          <path d="M 400 225 A 30 30 0 0 1 430 255 A 60 60 0 0 1 370 315 A 120 120 0 0 1 250 195 A 200 200 0 0 1 450 -5" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.6" />
          <circle cx="320" cy="240" r="50" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 2" />
          <circle cx="480" cy="240" r="50" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 2" />
          <circle cx="400" cy="130" r="35" fill="#020617" stroke="#fbbf24" strokeWidth="2.5" />
          <text x="400" y="137" fill="#fbbf24" fontSize="16" fontWeight="bold" fontFamily="serif" textAnchor="middle">Δ</text>
          {!isThumbnail && cleanTitle && (
            <text x="400" y="360" fill="#e2e8f0" fontSize="13" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              {cleanTitle}
            </text>
          )}
        </svg>
        <div className="absolute bottom-2 right-3 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-amber-400 border border-amber-500/30">
          Diyalektik & Mantık (Δ)
        </div>
      </div>
    );
  }

  if (category === 'etik-teknoloji') {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-amber-500/20 group ${className}`}>
        <svg viewBox="0 0 800 450" className="w-full h-full object-cover transform group-hover:scale-102 transition-transform duration-700">
          <defs>
            <linearGradient id="techBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#021c1e" />
              <stop offset="60%" stopColor="#06121e" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>
          <rect width="800" height="450" fill="url(#techBg)" />
          {/* Cybernetic Code Circuit Matrix */}
          <g stroke="#10b981" strokeWidth="1.2" opacity="0.4" fill="none">
            <polyline points="100,100 240,100 300,160 500,160 560,100 700,100" />
            <polyline points="100,350 240,350 300,290 500,290 560,350 700,350" />
            <circle cx="300" cy="160" r="4" fill="#10b981" />
            <circle cx="500" cy="160" r="4" fill="#10b981" />
            <circle cx="300" cy="290" r="4" fill="#10b981" />
            <circle cx="500" cy="290" r="4" fill="#10b981" />
          </g>
          {/* Central AI / Code Ring */}
          <rect x="340" y="175" width="120" height="100" rx="14" fill="#020617" stroke="#10b981" strokeWidth="2.5" />
          <text x="400" y="235" fill="#34d399" fontSize="28" fontWeight="bold" fontFamily="monospace" textAnchor="middle">&lt;AGI&gt;</text>
          {!isThumbnail && cleanTitle && (
            <text x="400" y="380" fill="#e2e8f0" fontSize="13" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              {cleanTitle}
            </text>
          )}
        </svg>
        <div className="absolute bottom-2 right-3 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-emerald-400 border border-emerald-500/30">
          Etik & Kodlanabilirlik
        </div>
      </div>
    );
  }

  // Default: Fizik & Kozmoloji / Epistemoloji General
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-amber-500/20 group ${className}`}>
      <svg viewBox="0 0 800 450" className="w-full h-full object-cover transform group-hover:scale-102 transition-transform duration-700">
        <defs>
          <linearGradient id="cosmicBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0b132b" />
            <stop offset="50%" stopColor="#1c2541" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        <rect width="800" height="450" fill="url(#cosmicBg)" />
        {/* Celestial Orbital Rings */}
        <ellipse cx="400" cy="225" rx="220" ry="80" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6" transform="rotate(-20 400 225)" />
        <ellipse cx="400" cy="225" rx="220" ry="80" fill="none" stroke="#38bdf8" strokeWidth="1.2" opacity="0.5" transform="rotate(35 400 225)" />
        {/* Core Star */}
        <circle cx="400" cy="225" r="30" fill="#f59e0b" fillOpacity="0.2" />
        <circle cx="400" cy="225" r="14" fill="#fbbf24" stroke="#ffffff" strokeWidth="2" />
        {!isThumbnail && cleanTitle && (
          <text x="400" y="380" fill="#e2e8f0" fontSize="13" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
            {cleanTitle}
          </text>
        )}
      </svg>
      <div className="absolute bottom-2 right-3 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-amber-400 border border-amber-500/30">
        Sci-Phi Kozmoloji
      </div>
    </div>
  );
};
