import React from 'react';
import {
  Cpu,
  BarChart3,
  Globe,
  Sliders,
  User,
  Search,
  ExternalLink,
  BookOpen,
  Share2,
  Volume2,
  Pause,
  Play,
  Square,
  Loader2,
  Languages,
  Mail,
  Linkedin
} from 'lucide-react';
import { COMPUTED_TOTAL_NET_READS } from '../data/baselineStats';
import { SUPPORTED_LANGUAGES, t } from '../utils/translations';
import { useSpeechEngine } from '../utils/speechEngine';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  lang: string;
  onSelectLang?: (code: string) => void;
  totalNetReads?: number;
  onOpenLanguage: () => void;
  onOpenSearch: () => void;
  onOpenAuthor: () => void;
  onOpenInvite?: () => void;
  onListenSite?: () => void;
  isSiteTranslating?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  lang,
  onSelectLang,
  totalNetReads = COMPUTED_TOTAL_NET_READS,
  onOpenLanguage,
  onOpenSearch,
  onOpenAuthor,
  onOpenInvite,
  onListenSite,
  isSiteTranslating = false
}) => {
  const speech = useSpeechEngine();
  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];

  const handleGlobalListenClick = () => {
    if (speech.isPlaying) {
      speech.pauseSpeech();
      return;
    }
    if (speech.isPaused) {
      speech.resumeSpeech();
      return;
    }
    if (onListenSite) {
      onListenSite();
    } else {
      speech.speakEntireVisiblePage(lang, speech.rate);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Primary Domain Badge */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onTabChange('articles')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-200 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                Φ
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  <span className="notranslate">Sci-Phi</span>
                  <span className="notranslate text-[10px] font-mono px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded font-normal">
                    sci-phi.ai.studio
                  </span>
                </span>
                <span className="block text-[10px] text-slate-400 font-medium">
                  {t('portal_subtitle', lang)} • <span className="notranslate text-amber-400/90 font-mono">emrepelit39@gmail.com</span> • <span className="notranslate text-sky-400/90 font-mono">www.linkedin.com/in/emrepelit109</span>
                </span>
              </div>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => onTabChange('articles')}
              className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                currentTab === 'articles'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t('nav_articles', lang)}</span>
            </button>
            <button
              onClick={() => onTabChange('simulators')}
              className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                currentTab === 'simulators'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{t('nav_simulators', lang)}</span>
            </button>
            <button
              onClick={() => onTabChange('stats')}
              className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                currentTab === 'stats'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>
                {t('nav_stats', lang)} ({totalNetReads.toLocaleString('tr-TR')})
              </span>
            </button>
            <button
              onClick={() => onTabChange('automation')}
              className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                currentTab === 'automation'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{t('nav_automation', lang)}</span>
            </button>
          </nav>

          {/* Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <PWAInstallButton lang={lang} />
            {onOpenInvite && (
              <button
                onClick={onOpenInvite}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition flex items-center gap-1.5"
                title={t('invite_btn', lang)}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{t('invite_btn', lang)}</span>
              </button>
            )}
            <button
              onClick={onOpenSearch}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition"
              title={t('search_placeholder', lang)}
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Çeviri Tuşu & Doğal Dil Seçici */}
            <div className="flex items-center bg-slate-900 border border-amber-500/40 rounded-lg px-2 py-1 text-xs">
              <button
                onClick={() => {
                  if (lang === 'tr') {
                    if (onSelectLang) onSelectLang('en');
                  } else {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(
                        new CustomEvent('sciphi:trigger-site-translation', { detail: { lang, force: true } })
                      );
                    }
                  }
                }}
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300 mr-1.5 font-bold cursor-pointer"
                title={lang === 'tr' ? 'Siteyi Doğal Dile Çevir (EN/TR)' : `${t('translate_btn', lang)} (Tüm Yazıları Çevir)`}
              >
                {isSiteTranslating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <Languages className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {isSiteTranslating ? (lang === 'tr' ? 'Çevriliyor...' : 'Translating...') : t('translate_btn', lang)}
                </span>
              </button>
              <button
                onClick={onOpenLanguage}
                className="p-1 hover:text-amber-400 text-slate-400 text-[11px] font-mono border-l border-slate-800 pr-1.5"
                title="Tüm 10 Dili Görüntüle"
              >
                <Globe className="w-3 h-3 text-amber-400 inline mr-0.5" />
              </button>
              <select
                value={lang}
                onChange={(e) => onSelectLang && onSelectLang(e.target.value)}
                className="notranslate bg-transparent text-slate-200 font-semibold text-xs focus:outline-none cursor-pointer border-l border-slate-800 pl-1.5"
                title="Hedef Doğal Dili Seçin"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="notranslate bg-slate-950 text-slate-200">
                    {l.flag} {l.code.toUpperCase()} - {l.nativeName}
                  </option>
                ))}
              </select>
            </div>

            {/* Tüm Siteyi Hedef Doğal Dilde Dinleme Tuşu */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleGlobalListenClick}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                  speech.isPlaying
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : speech.isPaused
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-900 text-amber-400 border-amber-500/40 hover:bg-amber-500 hover:text-slate-950'
                }`}
                title={`${t('audio_listen', lang)} (${currentLangObj.nativeName})`}
              >
                {speech.isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : speech.isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : speech.isPaused ? (
                  <Play className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {speech.isPlaying
                    ? t('audio_pause', lang)
                    : speech.isPaused
                    ? t('audio_resume', lang)
                    : t('listen_site_btn', lang)}
                </span>
              </button>

              {(speech.isPlaying || speech.isPaused) && (
                <button
                  onClick={() => speech.stopSpeech()}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-rose-400 border border-rose-500/30 transition"
                  title={t('stop_listen_btn', lang)}
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
              )}
            </div>

            <button
              onClick={onOpenAuthor}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 transition flex items-center gap-1.5 text-xs"
              title="Emre Pelit • emrepelit39@gmail.com"
            >
              <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="notranslate hidden 2xl:inline font-mono text-[11px] text-amber-300">
                emrepelit39@gmail.com
              </span>
            </button>
            <a
              href="mailto:emrepelit39@gmail.com"
              className="notranslate hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-[11px] font-mono transition"
              title="E-posta Gönder: emrepelit39@gmail.com"
            >
              <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>emrepelit39@gmail.com</span>
            </a>
            <a
              href="https://www.linkedin.com/in/emrepelit109"
              target="_blank"
              rel="noopener noreferrer"
              className="notranslate hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 text-[11px] font-mono transition"
              title="Emre Pelit LinkedIn: www.linkedin.com/in/emrepelit109"
            >
              <Linkedin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>linkedin.com/in/emrepelit109</span>
            </a>
            <a
              href="https://emrepelit7337.blogspot.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="notranslate hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
            >
              <span>Blogger</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Küresel Sesli Dinleme Kontrol Çubuğu (Aktif Dinleme Sırasında Gösterilir) */}
      {(speech.isPlaying || speech.isPaused || speech.isLoading) && (
        <div className="bg-slate-900/95 border-t border-amber-500/30 px-4 py-2 text-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] shrink-0">
                {currentLangObj.flag} {currentLangObj.nativeName} ({currentLangObj.speechCode})
              </span>
              <span className="text-slate-200 font-serif truncate">
                {speech.currentChunkText || speech.titleLabel || t('site_audio_playing', lang)}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px] font-mono">
                {[0.75, 1.0, 1.25, 1.5].map((r) => (
                  <button
                    key={r}
                    onClick={() => speech.setSpeechRate(r)}
                    className={`px-1.5 py-0.5 rounded transition ${
                      speech.rate === r
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-mono text-amber-400 w-9 text-right">
                %{speech.progress}
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};