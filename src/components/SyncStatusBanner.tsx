import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldCheck, Activity, Sparkles, Mail, Linkedin } from 'lucide-react';
import { SCI_PHI_BASELINE_STATS } from '../data/baselineStats';
import { t } from '../utils/translations';

interface SyncStatusBannerProps {
  lang?: string;
  totalNetReads?: number;
  totalPageViews?: number;
  baselineReads?: number;
  baselineViews?: number;
  liveAddedReads?: number;
  liveAddedViews?: number;
  activeVisitors?: number;
  bloggerPostsCount?: number;
  totalArticlesCount?: number;
  latestEventText?: string;
  onSyncRefresh?: () => Promise<void> | void;
}

export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({
  lang = 'tr',
  totalNetReads = SCI_PHI_BASELINE_STATS.total_net_reads_baseline,
  totalPageViews = SCI_PHI_BASELINE_STATS.total_views_baseline,
  baselineReads = 57956,
  baselineViews = 78181,
  liveAddedReads,
  liveAddedViews,
  activeVisitors = 28,
  bloggerPostsCount = 299,
  totalArticlesCount = 299,
  latestEventText,
  onSyncRefresh
}) => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSync, setLastSync] = useState<string>('Canlı');
  const [pulseHighlight, setPulseHighlight] = useState<boolean>(false);

  const computedLiveReads =
    liveAddedReads !== undefined ? liveAddedReads : Math.max(0, totalNetReads - baselineReads);
  const computedLiveViews =
    liveAddedViews !== undefined ? liveAddedViews : Math.max(0, totalPageViews - baselineViews);

  useEffect(() => {
    setPulseHighlight(true);
    const now = new Date();
    setLastSync(
      `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    );
    const timer = setTimeout(() => setPulseHighlight(false), 1200);
    return () => clearTimeout(timer);
  }, [totalNetReads, totalPageViews, bloggerPostsCount, totalArticlesCount]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    if (onSyncRefresh) {
      await onSyncRefresh();
    }
    setTimeout(() => {
      setIsSyncing(false);
      const now = new Date();
      setLastSync(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      );
    }, 400);
  };

  return (
    <div className="bg-slate-900/80 border-y border-slate-800/90 px-4 py-2 text-xs text-slate-300 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>{t('sync_active', lang)}</span>
          </div>

          <span className="text-slate-700 hidden sm:inline">•</span>

          <a
            href="https://emrepelit7337.blogspot.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 hover:border-emerald-400/60 px-2.5 py-0.5 rounded-lg transition"
            title="emrepelit7337.blogspot.com bloğundaki tüm 299 makaleyle her zaman canlı senkronize"
          >
            <RefreshCw className={`w-3 h-3 text-emerald-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="text-[11px] font-mono">
              emrepelit7337.blogspot.com: <strong className="text-white">{bloggerPostsCount}</strong> / <strong className="text-amber-400">{totalArticlesCount}</strong> Makale 1:1 Canlı Senkron
            </span>
          </a>

          <div className="flex items-center gap-1.5 text-slate-300 bg-slate-950/90 border border-slate-800 px-2.5 py-0.5 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px]">
              8 Site Açılıştan Beri (<strong className="text-white">24 Nisan 2026</strong>):{' '}
              <span className="font-mono text-slate-300">{baselineReads.toLocaleString('tr-TR')}</span> Taban{' '}
              <span className="text-emerald-400 font-mono font-bold">
                +{computedLiveReads.toLocaleString('tr-TR')} Canlı
              </span>{' '}
              ={' '}
              <strong
                className={`font-mono transition-colors duration-300 ${
                  pulseHighlight ? 'text-emerald-300 scale-105 inline-block' : 'text-amber-400'
                }`}
              >
                {totalNetReads.toLocaleString('tr-TR')}
              </strong>{' '}
              {t('net_reads_unit', lang)}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-slate-300 bg-slate-950/90 border border-slate-800 px-2.5 py-0.5 rounded-lg">
            <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-[11px]">
              Kümülatif Görüntüleme:{' '}
              <span className="font-mono text-slate-300">{baselineViews.toLocaleString('tr-TR')}</span> Taban{' '}
              <span className="text-sky-400 font-mono font-bold">
                +{computedLiveViews.toLocaleString('tr-TR')} Canlı
              </span>{' '}
              ={' '}
              <strong
                className={`font-mono transition-colors duration-300 ${
                  pulseHighlight ? 'text-white' : 'text-sky-400'
                }`}
              >
                {totalPageViews.toLocaleString('tr-TR')}
              </strong>{' '}
              {t('page_views_unit', lang)}
            </span>
          </div>

          <a
            href="mailto:emrepelit39@gmail.com"
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 hover:bg-amber-500/20 font-mono transition"
            title="Emre Pelit Resmi E-posta: emrepelit39@gmail.com"
          >
            <Mail className="w-3 h-3 text-amber-400 shrink-0" />
            <span>emrepelit39@gmail.com</span>
          </a>

          <a
            href="https://www.linkedin.com/in/emrepelit109"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-300 hover:bg-sky-500/20 font-mono transition"
            title="Emre Pelit LinkedIn: www.linkedin.com/in/emrepelit109"
          >
            <Linkedin className="w-3 h-3 text-sky-400 shrink-0" />
            <span>www.linkedin.com/in/emrepelit109</span>
          </a>

          {latestEventText && (
            <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 font-mono max-w-xs truncate">
              <Sparkles className="w-3 h-3 text-emerald-400 shrink-0 animate-pulse" />
              <span className="truncate">{latestEventText}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{activeVisitors} Aktif Okuyucu</span>
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {t('last_sync_label', lang)}: <strong className="text-slate-200">{lastSync}</strong>
          </span>
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="p-1 text-slate-400 hover:text-amber-400 rounded transition cursor-pointer"
            title="emrepelit7337.blogspot.com ve 8 Site İstatistiklerini Şimdi Senkronize Et"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};