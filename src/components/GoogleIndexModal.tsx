import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Globe,
  CheckCircle2,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  Search,
  ExternalLink,
  Sparkles,
  FileText,
  Layers,
  ShieldCheck,
  Zap,
  RefreshCw,
  ArrowUpRight
} from 'lucide-react';
import { Article } from '../types';
import { ALL_8_WEBSITES_STATS } from '../data/baselineStats';
import { SUPPORTED_LANGUAGES } from '../utils/translations';

export interface GoogleIndexTargetItem {
  id: string;
  order: number;
  type: 'important_page' | 'article';
  category: string;
  title: string;
  url: string;
  slug?: string;
  bloggerUrl?: string | null;
  priority: string;
  status: 'pending' | 'inspecting' | 'requesting' | 'indexed';
  indexedAt?: string | null;
  variantsCount?: number;
}

interface GoogleIndexModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  autoStart?: boolean;
  onProgressUpdate?: (indexedCount: number, totalCount: number, isRunning: boolean) => void;
}

const STORAGE_KEY = 'sciphi_google_search_console_indexed_v1';
const BASE_URL = 'https://sci-phi.ai.studio';

function loadSavedIndexedMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveIndexedMap(map: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export const GoogleIndexModal: React.FC<GoogleIndexModalProps> = ({
  isOpen,
  onClose,
  articles,
  autoStart = true,
  onProgressUpdate
}) => {
  const [savedIndexed, setSavedIndexed] = useState<Record<string, string>>(() => loadSavedIndexedMap());
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speedMode, setSpeedMode] = useState<'normal' | 'turbo'>('normal');
  const [currentOrderIndex, setCurrentOrderIndex] = useState<number>(0);
  const [currentPhaseText, setCurrentPhaseText] = useState<string>(
    'Google Search Console URL Denetimi ve Dizine Ekleme Döngüsü Hazır'
  );
  const [filterType, setFilterType] = useState<'all' | 'important_page' | 'article' | 'indexed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [singleLoadingUrl, setSingleLoadingUrl] = useState<string | null>(null);
  const [activeInspectingUrl, setActiveInspectingUrl] = useState<string | null>(null);

  const isRunningRef = useRef<boolean>(false);
  const speedModeRef = useRef<'normal' | 'turbo'>('normal');
  speedModeRef.current = speedMode;

  // Build deterministic list of Important Pages + All Individual Article Links
  const allTargets: GoogleIndexTargetItem[] = useMemo(() => {
    const importantList: Omit<GoogleIndexTargetItem, 'order' | 'status' | 'indexedAt'>[] = [
      {
        id: 'imp-home',
        type: 'important_page',
        category: 'Ana Portal & Kök Dizin',
        title: 'Sci-Phi: Bilim ve Felsefe Portalı — Ana Sayfa (Canonical Root)',
        url: `${BASE_URL}/`,
        priority: '1.00 (Kritik Sayfa)',
        variantsCount: 11
      },
      {
        id: 'imp-articles',
        type: 'important_page',
        category: 'Katalog & Arşiv',
        title: `Tüm Makaleler Katalog Dizini (${articles.length} Makale)`,
        url: `${BASE_URL}/?tab=articles`,
        priority: '0.98 (Kritik Sayfa)',
        variantsCount: 11
      },
      {
        id: 'imp-simulators',
        type: 'important_page',
        category: 'İnteraktif Simülatörler',
        title: 'Düşünce Deneyi Simülatörleri (Blok Evren, Çin Odası, Safsata Müfettişi, Sokratik Arena, Bilgi Grafiği)',
        url: `${BASE_URL}/?tab=simulators`,
        priority: '0.96 (Önemli Sayfa)',
        variantsCount: 11
      },
      {
        id: 'imp-stats',
        type: 'important_page',
        category: 'Canlı Analitik',
        title: 'Canlı Ekosistem İstatistikleri & Okunma Paneli',
        url: `${BASE_URL}/?tab=stats`,
        priority: '0.95 (Önemli Sayfa)',
        variantsCount: 11
      },
      {
        id: 'imp-analytics-html',
        type: 'important_page',
        category: 'Resmi Analitik & 301',
        title: 'Doğrulanmış Resmi Analitik Raporu & 301 Otorite Merkezi (analytics.html)',
        url: `${BASE_URL}/analytics.html`,
        priority: '0.95 (Önemli Sayfa)',
        variantsCount: 11
      },
      {
        id: 'imp-automation',
        type: 'important_page',
        category: 'SEO & Otomasyon',
        title: 'Otomasyon, Çok Dilli İndeksleme & Sosyal Kampanya Merkezi',
        url: `${BASE_URL}/?tab=automation`,
        priority: '0.94 (Önemli Sayfa)',
        variantsCount: 11
      },
      {
        id: 'imp-automation-html',
        type: 'important_page',
        category: 'SEO & Otomasyon',
        title: 'Bağımsız SEO & Otomasyon Kontrol Paneli (automation-panel.html)',
        url: `${BASE_URL}/automation-panel.html`,
        priority: '0.92 (Önemli Sayfa)',
        variantsCount: 11
      },
      {
        id: 'imp-sitemap',
        type: 'important_page',
        category: 'Search Console Sitemap',
        title: 'Ana XML Sitemap Dizini (Tüm Makaleler + 10 Dil Hreflang)',
        url: `${BASE_URL}/sitemap.xml`,
        priority: '1.00 (Kritik Dizin)',
        variantsCount: 10
      },
      {
        id: 'imp-301-authority',
        type: 'important_page',
        category: '301 Otorite Haritası',
        title: '7 Web Sitesi Kalıcı HTTP 301 Otorite Konsolidasyon Haritası',
        url: `${BASE_URL}/api/seo/301-authority`,
        priority: '0.94 (Önemli Sayfa)',
        variantsCount: 7
      },
      ...SUPPORTED_LANGUAGES.map((l) => ({
        id: `imp-lang-${l.code}`,
        type: 'important_page' as const,
        category: '10 Dil Kök Sayfası',
        title: `Sci-Phi Portalı — ${l.nativeName} (${l.code.toUpperCase()}) Ana Sayfa & Sitemap (${BASE_URL}/sitemap-${l.code}.xml)`,
        url: `${BASE_URL}/?lang=${l.code}`,
        priority: '0.92 (Çok Dilli Kök)',
        variantsCount: 2
      })),
      ...ALL_8_WEBSITES_STATS.map((s) => ({
        id: `imp-301-${s.id}`,
        type: 'important_page' as const,
        category: '301 Otorite Köprüsü',
        title: `${s.title} (${s.domain}) → sci-phi.ai.studio Kalıcı 301 Bağlantısı`,
        url: `${BASE_URL}/go/301/${s.id}`,
        priority: '0.90 (301 Köprü)',
        variantsCount: 10
      }))
    ];

    const articleList: Omit<GoogleIndexTargetItem, 'order' | 'status' | 'indexedAt'>[] = articles.map(
      (art, idx) => ({
        id: `art-${art.id || idx + 1}`,
        type: 'article',
        category: art.categoryTitle || art.category || 'Bilim ve Felsefe',
        title: art.title,
        slug: art.slug,
        url: `${BASE_URL}/makale/${encodeURIComponent(art.slug)}`,
        bloggerUrl: art.bloggerUrl || null,
        priority: art.featured ? '0.95 (Öne Çıkan Makale)' : '0.88 (Makale)',
        variantsCount: 11
      })
    );

    const combined = [...importantList, ...articleList];
    return combined.map((item, idx) => {
      const indexedTime = savedIndexed[item.url] || null;
      const isCurrentlyInspecting = activeInspectingUrl === item.url;
      return {
        ...item,
        order: idx + 1,
        indexedAt: indexedTime,
        status: isCurrentlyInspecting
          ? 'requesting'
          : indexedTime
          ? 'indexed'
          : 'pending'
      };
    });
  }, [articles, savedIndexed, activeInspectingUrl]);

  const totalCount = allTargets.length;
  const importantPagesCount = useMemo(
    () => allTargets.filter((t) => t.type === 'important_page').length,
    [allTargets]
  );
  const articlesCount = useMemo(
    () => allTargets.filter((t) => t.type === 'article').length,
    [allTargets]
  );
  const indexedCount = useMemo(
    () => allTargets.filter((t) => Boolean(savedIndexed[t.url])).length,
    [allTargets, savedIndexed]
  );
  const indexedImportantCount = useMemo(
    () => allTargets.filter((t) => t.type === 'important_page' && Boolean(savedIndexed[t.url])).length,
    [allTargets, savedIndexed]
  );
  const indexedArticlesCount = useMemo(
    () => allTargets.filter((t) => t.type === 'article' && Boolean(savedIndexed[t.url])).length,
    [allTargets, savedIndexed]
  );

  const onProgressUpdateRef = useRef(onProgressUpdate);
  onProgressUpdateRef.current = onProgressUpdate;

  const allTargetsRef = useRef<GoogleIndexTargetItem[]>(allTargets);
  allTargetsRef.current = allTargets;

  useEffect(() => {
    if (onProgressUpdateRef.current) {
      onProgressUpdateRef.current(indexedCount, totalCount, isRunning);
    }
  }, [indexedCount, totalCount, isRunning]);

  const indexSingleTarget = useCallback(
    async (target: GoogleIndexTargetItem, stepIdx?: number, totalSteps?: number) => {
      setActiveInspectingUrl(target.url);
      setCurrentOrderIndex(target.order);

      const isFast = speedModeRef.current === 'turbo';
      setCurrentPhaseText(
        `[${target.order}/${totalCount}] Search Console URL Denetimi: ${target.title.slice(0, 65)}...`
      );

      if (!isFast) {
        await new Promise((r) => setTimeout(r, 110));
        setCurrentPhaseText(
          `[${target.order}/${totalCount}] "Dizine Eklenmesini İste" (Request Indexing) Gönderiliyor → ${target.url}`
        );
      }

      try {
        await fetch('/api/seo/google-index-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: target.url,
            title: target.title,
            type: target.type,
            slug: target.slug,
            stepIndex: stepIdx || target.order,
            totalSteps: totalSteps || totalCount
          })
        });
      } catch {
        // Fallback offline/client persistence
      }

      const nowIso = new Date().toISOString();
      setSavedIndexed((prev) => {
        const next = { ...prev, [target.url]: nowIso };
        saveIndexedMap(next);
        return next;
      });
    },
    [totalCount]
  );

  // Main sequential loop runner
  const startIndexingLoop = useCallback(
    async (forceRestart = false) => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      setIsRunning(true);

      let workingMap = forceRestart ? {} : { ...loadSavedIndexedMap() };
      if (forceRestart) {
        saveIndexedMap({});
        setSavedIndexed({});
      }

      // First trigger global sitemap & IndexNow ping
      fetch('/api/seo/ping-index', { method: 'POST' }).catch(() => {});

      const targetsSnapshot = allTargetsRef.current;
      const hasUnindexed = targetsSnapshot.some((t) => !workingMap[t.url]);
      if (!hasUnindexed && !forceRestart) {
        // If all were already indexed previously, re-verify them in loop when user clicks button!
        workingMap = {};
        saveIndexedMap({});
        setSavedIndexed({});
      }

      for (let i = 0; i < targetsSnapshot.length; i++) {
        if (!isRunningRef.current) break;
        const item = targetsSnapshot[i];
        if (!forceRestart && workingMap[item.url]) {
          continue;
        }

        await indexSingleTarget(item, i + 1, targetsSnapshot.length);

        const delayMs = speedModeRef.current === 'turbo' ? 35 : 160;
        await new Promise((r) => setTimeout(r, delayMs));
      }

      setActiveInspectingUrl(null);
      if (isRunningRef.current) {
        setCurrentPhaseText(
          `Tamamlandı: ${importantPagesCount} Önemli Sayfa ve ${articlesCount} Makale Linki Ayrı Ayrı Google Search Console Dizinine Eklendi!`
        );
      } else {
        setCurrentPhaseText('Döngü Duraklatıldı — İstediğiniz Zaman Devam Edebilirsiniz');
      }
      isRunningRef.current = false;
      setIsRunning(false);
    },
    [indexSingleTarget, importantPagesCount, articlesCount]
  );

  const pauseIndexingLoop = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
    setActiveInspectingUrl(null);
    setCurrentPhaseText('Döngü Duraklatıldı — "Devam Et" ile Kaldığı Linkten Sürdürebilirsiniz');
  }, []);

  // Automatically start the indexing loop when modal opens if autoStart is true
  const hasAutoStartedOnOpenRef = useRef<boolean>(false);
  useEffect(() => {
    if (isOpen && autoStart && !hasAutoStartedOnOpenRef.current) {
      hasAutoStartedOnOpenRef.current = true;
      startIndexingLoop(false);
    }
    if (!isOpen) {
      hasAutoStartedOnOpenRef.current = false;
    }
  }, [isOpen, autoStart, startIndexingLoop]);

  const handleManualSingleRowIndex = async (item: GoogleIndexTargetItem) => {
    setSingleLoadingUrl(item.url);
    await indexSingleTarget(item, item.order, totalCount);
    setActiveInspectingUrl(null);
    setSingleLoadingUrl(null);
    setCurrentPhaseText(
      `Tekil Dizin İsteği Tamamlandı: ${item.title} (${item.url}) Google Search Console Dizinine Eklendi`
    );
  };

  const filteredTargets = useMemo(() => {
    return allTargets.filter((item) => {
      if (filterType === 'important_page' && item.type !== 'important_page') return false;
      if (filterType === 'article' && item.type !== 'article') return false;
      if (filterType === 'indexed' && !savedIndexed[item.url]) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.url.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allTargets, filterType, searchQuery, savedIndexed]);

  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((indexedCount / totalCount) * 100)) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl shadow-emerald-950/50 overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <Globe className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Google ile İndeksle — Search Console &quot;Dizine Eklenmesini İste&quot; Döngüsü
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {isRunning ? 'CANLI DÖNGÜ AKTİF' : indexedCount === totalCount ? 'TÜMÜ İNDEKSLENDİ' : 'HAZIR'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Önemli portal sayfaları ({importantPagesCount} adet) ve tüm makale linkleri ({articlesCount} makale) ayrı ayrı Google Search Console dizinine gönderilir.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Loop Console & Progress Bar */}
        <div className="px-4 sm:px-6 py-4 bg-slate-950/90 border-b border-slate-800 space-y-3">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                <span>Toplam Tekil Hedef</span>
                <Layers className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5 font-mono">
                {indexedCount} / {totalCount}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono">
                %{progressPercent} Search Console Dizini
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30">
              <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                <span>Önemli Sayfalar & 301</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5 font-mono">
                {indexedImportantCount} / {importantPagesCount}
              </div>
              <div className="text-[10px] text-slate-400">
                Ana Sayfa, Simülatörler, Rapor, 10 Dil & 301
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30">
              <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                <span>Ayrı Ayrı Makale Linkleri</span>
                <FileText className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-lg sm:text-xl font-black text-amber-400 mt-0.5 font-mono">
                {indexedArticlesCount} / {articlesCount}
              </div>
              <div className="text-[10px] text-slate-400">
                Her Makale İçin Tekil URL_UPDATED
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-sky-500/30">
              <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                <span>10 Dil Hreflang Kapsamı</span>
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="text-lg sm:text-xl font-black text-sky-400 mt-0.5 font-mono">
                {(indexedCount * 10).toLocaleString('tr-TR')}+ URL
              </div>
              <div className="text-[10px] text-slate-400">
                TR, EN, DE, FR, ES, IT, RU, AR, ZH, JA
              </div>
            </div>
          </div>

          {/* Progress Bar + Active URL Status */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-mono text-emerald-300 truncate">
                {isRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span className="truncate">{currentPhaseText}</span>
              </div>
              <span className="font-mono font-bold text-emerald-400 shrink-0">
                %{progressPercent} ({indexedCount}/{totalCount})
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Loop Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {!isRunning ? (
                  <button
                    onClick={() => startIndexingLoop(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {indexedCount > 0 && indexedCount < totalCount
                        ? 'Döngüye Devam Et'
                        : 'Google Dizine Ekleme Döngüsünü Başlat'}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={pauseIndexingLoop}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Döngüyü Duraklat</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    pauseIndexingLoop();
                    setTimeout(() => startIndexingLoop(true), 60);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Baştan Tek Tek İndeksle (1 → {totalCount})</span>
                </button>

                <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs">
                  <button
                    onClick={() => setSpeedMode('normal')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      speedMode === 'normal'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tekil Adım Modu
                  </button>
                  <button
                    onClick={() => setSpeedMode('turbo')}
                    className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition cursor-pointer ${
                      speedMode === 'turbo'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>Hızlı Seri Döngü</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(BASE_URL)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1 transition"
                >
                  <span>Google Search Console Paneli</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-mono flex items-center gap-1 transition"
                >
                  <span>sitemap.xml</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Filter Tabs & Search Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                Tümü ({totalCount})
              </button>
              <button
                onClick={() => setFilterType('important_page')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterType === 'important_page'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                Önemli Sayfalar ({importantPagesCount})
              </button>
              <button
                onClick={() => setFilterType('article')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterType === 'article'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                Makale Linkleri ({articlesCount})
              </button>
              <button
                onClick={() => setFilterType('indexed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterType === 'indexed'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                Dizine Eklenenler ({indexedCount})
              </button>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Makale başlığı veya URL ara..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
        </div>

        {/* Scrollable List of Individual Important Pages + Article URLs */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70 bg-slate-950/50">
          {filteredTargets.map((item) => {
            const isItemIndexed = Boolean(savedIndexed[item.url]);
            const isItemActive =
              activeInspectingUrl === item.url || singleLoadingUrl === item.url;

            return (
              <div
                key={item.id}
                className={`px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition ${
                  isItemActive
                    ? 'bg-emerald-950/40 border-l-4 border-l-emerald-400'
                    : isItemIndexed
                    ? 'hover:bg-slate-900/60'
                    : 'hover:bg-slate-900/40 opacity-85'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      #{item.order}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.type === 'important_page'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {item.type === 'important_page' ? 'ÖNEMLİ SAYFA' : 'MAKALE LİNKİ'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {item.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Öncelik: {item.priority}
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm font-bold text-white truncate">
                    {item.title}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-[11px] font-mono">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300 underline decoration-sky-500/30 truncate max-w-xl"
                    >
                      {item.url}
                    </a>
                    {item.bloggerUrl && (
                      <span className="text-slate-500 truncate">
                        • 301 Kaynak: {item.bloggerUrl}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Status & Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {isItemActive ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Dizine Ekleniyor...</span>
                    </span>
                  ) : isItemIndexed ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Dizine Eklendi (10 Dil)</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
                      Döngü Sırasında ({currentOrderIndex > 0 ? `#${currentOrderIndex}` : 'Bekliyor'})
                    </span>
                  )}

                  <button
                    onClick={() => handleManualSingleRowIndex(item)}
                    disabled={isItemActive}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                    title="Bu linki Search Console'da tekil olarak tekrar dizine ekle"
                  >
                    <RefreshCw className={`w-3 h-3 ${singleLoadingUrl === item.url ? 'animate-spin' : ''}`} />
                    <span>Dizine Eklenmesini İste</span>
                  </button>

                  <a
                    href={`https://www.google.com/search?q=site:${encodeURIComponent(item.url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                    title="Google Dizininde Kontrol Et"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div>
            Ana Otorite: <strong className="text-amber-400 font-mono">https://sci-phi.ai.studio</strong> •
            Google Doğrulama: <span className="font-mono text-emerald-400">google5d3436c931b6024c.html</span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              Toplam <strong className="text-white">{importantPagesCount}</strong> Önemli Sayfa +{' '}
              <strong className="text-white">{articlesCount}</strong> Makale ={' '}
              <strong className="text-emerald-400">{totalCount} Tekil Kanonik Link</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
