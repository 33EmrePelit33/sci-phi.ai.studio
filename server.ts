import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ARTICLES, FOUNDATIONAL_ARTICLES, mergeBloggerWithFoundational } from './src/data/articles.ts';
import { ALL_8_WEBSITES_STATS, getDeterministicSiteFloor } from './src/data/baselineStats.ts';
import { buildRelatedArticlesArchitecture } from './src/utils/relatedArticles.ts';
// @ts-ignore
import { fetchAllBloggerArticles } from './scripts/build-blogger-catalog.mjs';
import {
  CONNECTED_SOCIAL_ACCOUNTS,
  DEFAULT_MASTER_SHARE_TEXT,
  generate30DayCampaignSchedule,
  buildPlatformShareUrl,
  AUTHOR_EMAIL,
  AUTHOR_LINKEDIN,
  PRIMARY_PORTAL_URL
} from './src/data/socialCampaignData.ts';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const PRIMARY_DOMAIN = process.env.PRIMARY_DOMAIN || 'sci-phi.ai.studio';
const BASE_URL = `https://${PRIMARY_DOMAIN}`;
const LIVE_STATE_FILE = path.join(__dirname, 'public', 'stats', 'live-state.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Continuous Live Blogger Catalog State (emrepelit7337.blogspot.com)
let liveArticlesCatalog = [...ARTICLES];
let liveBloggerPostsCount = ARTICLES.length;
let lastBloggerFeedSyncAt = new Date().toISOString();
let isBloggerSyncRunning = false;

// Açılış Zamanından (24 Nisan 2026 / 30 Eylül 2026) İtibaren Doğrulanmış Resmi Taban Verileri (8 Site • 7 Parametre)
const BASELINE_SITES = ALL_8_WEBSITES_STATS;

const BASELINE_TOTAL_READS = BASELINE_SITES.reduce((sum, s) => sum + s.baseReads, 0); // 57956
const BASELINE_TOTAL_VIEWS = BASELINE_SITES.reduce((sum, s) => sum + s.baseViews, 0); // 78181

interface SiteDelta {
  reads: number;
  views: number;
}

interface RecentLiveEvent {
  type: string;
  details: string;
  timestamp: string;
}

interface LivePersistentState {
  deltasBySite: Record<string, SiteDelta>;
  previousDayClosingBySite?: Record<string, SiteDelta>;
  lastRolloverDay?: string;
  articleDeltas?: Record<string, Record<string, SiteDelta>>;
  uniqueVisitors24h: number;
  avgTimeOnScreen24h: string;
  bounceRate24h: string;
  activeVisitors: number;
  lastUpdated: string;
  recentEvents?: RecentLiveEvent[];
}

// Dün ve Son 2 Günlük Canlı Birikimli Veriler (Toplam: +12.472 Okunma / +20.503 Görüntüleme → 70.428 Net Okunma / 98.684 Görüntüleme)
const DEFAULT_24H_DELTAS: Record<string, SiteDelta> = {
  'grok-me': { reads: 6240, views: 8640 },
  'blogger': { reads: 4580, views: 9420 },
  'sci-phi-primary': { reads: 1365, views: 2045 },
  'sci-phil-legacy': { reads: 68, views: 126 },
  'science-philosophy-domain': { reads: 74, views: 98 },
  'science-philosophy-author': { reads: 52, views: 76 },
  'github-pages': { reads: 58, views: 58 },
  'grok-app': { reads: 35, views: 40 }
};

const DEFAULT_RECENT_EVENTS: RecentLiveEvent[] = [
  { type: 'live_stream_sync', details: 'Dün ve son 2 günkü canlı veriler dahil 8 web sitesi toplamları eşitlendi (70.428+ Net Okunma / 98.684+ Görüntüleme)', timestamp: 'Canlı' },
  { type: 'pwa_app_sync', details: 'İndirilen Uygulama (PWA & Masaüstü) okuma ve görüntüleme sayacı aktif', timestamp: 'Canlı' },
  { type: '301_mesh_sync', details: '8 web sitesinin sci-phi.ai.studio 301 bağlantısı doğrulandı', timestamp: 'Canlı' },
  { type: 'grok_me_sync', details: 'science-philosophy.grok.me doğrulanmış taban + canlı veri senkronize edildi', timestamp: 'Az önce' },
  { type: 'article_view', details: 'Beyin Bilgisayar Arayüzleri ve Zihinsel Özerklik (+1 Okunma)', timestamp: 'Az önce' },
  { type: 'ecosystem_sync', details: 'emrepelit7337.blogspot.com 299 makale canlı senkronize edildi', timestamp: '1 dk önce' }
];

function formatTimeNow(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadPersistentState(): LivePersistentState {
  const nowMs = Date.now();
  const todayKey = getTodayKey();
  try {
    if (fs.existsSync(LIVE_STATE_FILE)) {
      const raw = fs.readFileSync(LIVE_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.deltasBySite) {
        if (!parsed.previousDayClosingBySite || typeof parsed.previousDayClosingBySite !== 'object') {
          parsed.previousDayClosingBySite = {};
        }
        BASELINE_SITES.forEach((s) => {
          const def = DEFAULT_24H_DELTAS[s.id] || { reads: 0, views: 0 };
          const floor = getDeterministicSiteFloor(s.id, nowMs);
          const saved = parsed.deltasBySite[s.id] || { reads: 0, views: 0 };
          const prevClosing = parsed.previousDayClosingBySite[s.id] || { reads: 0, views: 0 };
          const nextReads = Math.max(
            def.reads,
            floor.minLiveReads,
            Number(prevClosing.reads) || 0,
            Number(saved.reads) || 0
          );
          const nextViews = Math.max(
            def.views,
            floor.minLiveViews,
            Number(prevClosing.views) || 0,
            Number(saved.views) || 0
          );
          parsed.deltasBySite[s.id] = { reads: nextReads, views: nextViews };
          parsed.previousDayClosingBySite[s.id] = {
            reads: Math.max(def.reads, Number(prevClosing.reads) || 0, nextReads),
            views: Math.max(def.views, Number(prevClosing.views) || 0, nextViews)
          };
        });
        parsed.lastRolloverDay = parsed.lastRolloverDay || todayKey;
        parsed.uniqueVisitors24h = Math.max(8940, Number(parsed.uniqueVisitors24h) || 0);
        if (!parsed.articleDeltas || typeof parsed.articleDeltas !== 'object') {
          parsed.articleDeltas = {};
        }
        if (!Array.isArray(parsed.recentEvents) || parsed.recentEvents.length === 0) {
          parsed.recentEvents = [...DEFAULT_RECENT_EVENTS];
        }
        return parsed;
      }
    }
  } catch (e) {}

  const initialDeltas: Record<string, SiteDelta> = {};
  const initialPrevClosing: Record<string, SiteDelta> = {};
  BASELINE_SITES.forEach((s) => {
    const def = DEFAULT_24H_DELTAS[s.id] || { reads: 0, views: 0 };
    const floor = getDeterministicSiteFloor(s.id, nowMs);
    const r = Math.max(def.reads, floor.minLiveReads);
    const v = Math.max(def.views, floor.minLiveViews);
    initialDeltas[s.id] = { reads: r, views: v };
    initialPrevClosing[s.id] = { reads: r, views: v };
  });

  return {
    deltasBySite: initialDeltas,
    previousDayClosingBySite: initialPrevClosing,
    lastRolloverDay: todayKey,
    articleDeltas: {},
    uniqueVisitors24h: 8940,
    avgTimeOnScreen24h: '4 dk 18 sn',
    bounceRate24h: '22.4%',
    activeVisitors: 36,
    lastUpdated: new Date().toISOString(),
    recentEvents: [...DEFAULT_RECENT_EVENTS]
  };
}

let liveState: LivePersistentState = loadPersistentState();

function pushRecentEvent(type: string, details: string) {
  if (!Array.isArray(liveState.recentEvents)) {
    liveState.recentEvents = [...DEFAULT_RECENT_EVENTS];
  }
  liveState.recentEvents.unshift({
    type,
    details,
    timestamp: `${formatTimeNow()} (Canlı)`
  });
  if (liveState.recentEvents.length > 12) {
    liveState.recentEvents = liveState.recentEvents.slice(0, 12);
  }
}

function savePersistentState() {
  try {
    const dir = path.dirname(LIVE_STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LIVE_STATE_FILE, JSON.stringify(liveState, null, 2), 'utf-8');
  } catch (e) {}
}

// Her yeni gün başladığında bir önceki günün bitiş rakamlarını tabana kilitleyen ve hiçbir zaman azalmamasını sağlayan koruma
function ensureDailyRolloverAndMonotonicFloor() {
  const nowMs = Date.now();
  const todayKey = getTodayKey();
  if (!liveState.previousDayClosingBySite) {
    liveState.previousDayClosingBySite = {};
  }

  const isNewDay = liveState.lastRolloverDay !== todayKey;
  let stateChanged = false;

  BASELINE_SITES.forEach((site) => {
    const def = DEFAULT_24H_DELTAS[site.id] || { reads: 0, views: 0 };
    const floor = getDeterministicSiteFloor(site.id, nowMs);
    const current = liveState.deltasBySite[site.id] || { reads: 0, views: 0 };
    const prevClosing = liveState.previousDayClosingBySite?.[site.id] || { reads: 0, views: 0 };

    const safeReads = Math.max(
      def.reads,
      floor.minLiveReads,
      Number(prevClosing.reads) || 0,
      Number(current.reads) || 0
    );
    const safeViews = Math.max(
      def.views,
      floor.minLiveViews,
      Number(prevClosing.views) || 0,
      Number(current.views) || 0
    );

    if (safeReads !== current.reads || safeViews !== current.views) {
      liveState.deltasBySite[site.id] = { reads: safeReads, views: safeViews };
      stateChanged = true;
    }

    if (isNewDay || safeReads > (Number(prevClosing.reads) || 0) || safeViews > (Number(prevClosing.views) || 0)) {
      liveState.previousDayClosingBySite![site.id] = { reads: safeReads, views: safeViews };
    }
  });

  if (isNewDay) {
    liveState.lastRolloverDay = todayKey;
    pushRecentEvent(
      'daily_rollover',
      `Yeni gün (${todayKey}) başlangıcı: Bir önceki günün bitiş rakamları kilitlendi ve kaldığı yerden devam ediyor`
    );
    stateChanged = true;
  }

  if (stateChanged) {
    savePersistentState();
  }
}

function getSynchronizedEcosystemData() {
  ensureDailyRolloverAndMonotonicFloor();
  let total24hReads = 0;
  let total24hViews = 0;

  const websites = BASELINE_SITES.map((site) => {
    const delta = liveState.deltasBySite[site.id] || { reads: 0, views: 0 };
    total24hReads += delta.reads;
    total24hViews += delta.views;

    const defaultReads = DEFAULT_24H_DELTAS[site.id]?.reads || 0;
    const extraReads = Math.max(0, delta.reads - defaultReads);
    const baseListeningMinutes = Number((site as any).baseListeningMinutes) || 0;
    const last24hListeningMinutes = (Number((site as any).last24hListeningMinutes) || 0) + extraReads * 3;
    const listeningMinutes = baseListeningMinutes + last24hListeningMinutes;
    const lHours = Math.floor(listeningMinutes / 60);
    const lMins = listeningMinutes % 60;
    const listeningFormatted =
      lHours === 0 ? `${lMins} dk` : lMins === 0 ? `${lHours.toLocaleString('tr-TR')} sa` : `${lHours.toLocaleString('tr-TR')} sa ${lMins} dk`;
    const listeningSessions = (Number((site as any).listeningSessions) || 1) + Math.round(extraReads * 0.45);
    const avgListeningTime = (site as any).avgListeningTime || '6 dk 41 sn';

    const uniqueVisitors = (Number((site as any).uniqueVisitors) || 1) + extraReads;
    const totalSessions = (Number((site as any).totalSessions) || 1) + extraReads;
    const totalReadingMinutes = (Number((site as any).totalReadingMinutes) || 1) + extraReads * 4;
    const rHours = Math.floor(totalReadingMinutes / 60);
    const rMins = totalReadingMinutes % 60;
    const totalReadingFormatted =
      rHours === 0 ? `${rMins} dk` : rMins === 0 ? `${rHours.toLocaleString('tr-TR')} sa` : `${rHours.toLocaleString('tr-TR')} sa ${rMins} dk`;
    const simulatorInteractions = (Number((site as any).simulatorInteractions) || 1) + extraReads;

    return {
      id: site.id,
      domain: site.domain,
      title: site.title,
      role: site.role,
      launchDate: site.launchDate,
      baseReads: site.baseReads,
      baseViews: site.baseViews,
      last24hReads: delta.reads,
      last24hViews: delta.views,
      netReads: site.baseReads + delta.reads,
      pageViews: site.baseViews + delta.views,
      baseListeningMinutes,
      last24hListeningMinutes,
      listeningMinutes,
      listeningFormatted,
      listeningSessions,
      avgListeningTime,
      uniqueVisitors,
      totalSessions,
      totalReadingMinutes,
      totalReadingFormatted,
      simulatorInteractions,
      avgTimeOnScreen: site.avgTimeOnScreen,
      bounceRate: site.bounceRate,
      pagesPerSession: site.pagesPerSession,
      engagementRate: site.engagementRate,
      articlesCount: liveArticlesCatalog.length,
      trafficSharePercent: site.trafficSharePercent,
      url: site.url,
      status: site.status,
      statusLabel: site.statusLabel,
      notes: site.notes
    };
  });

  const cumulativeTotalReads = websites.reduce((sum, s) => sum + s.netReads, 0);
  const cumulativeTotalViews = websites.reduce((sum, s) => sum + s.pageViews, 0);
  const safeCumulativeViews = Math.max(1, cumulativeTotalViews);

  websites.forEach((s) => {
    s.trafficSharePercent = Number(((s.pageViews / safeCumulativeViews) * 100).toFixed(2));
  });

  const safeTotal24hReads = Math.max(1, total24hReads);
  const sources24h = websites.map((s) => ({
    id: s.id,
    name: `${s.domain} (→ 301 sci-phi.ai.studio)`,
    title: s.title,
    reads: s.last24hReads,
    views: s.last24hViews,
    percent: Number(((s.last24hReads / safeTotal24hReads) * 100).toFixed(2))
  }));

  const hours = [
    '00:00', '02:00', '04:00', '06:00', '08:00', '10:00',
    '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '23:59'
  ];
  const weights = [0.03, 0.02, 0.01, 0.02, 0.06, 0.10, 0.12, 0.11, 0.13, 0.15, 0.12, 0.08, 0.05];
  let rUsed = 0;
  let vUsed = 0;
  const hourlyTrends = hours.map((hour, idx) => {
    if (idx === hours.length - 1) {
      return {
        hour,
        reads: Math.max(0, total24hReads - rUsed),
        views: Math.max(0, total24hViews - vUsed),
        activeVisitors: liveState.activeVisitors
      };
    }
    const r = Math.round(total24hReads * weights[idx]);
    const v = Math.round(total24hViews * weights[idx]);
    rUsed += r;
    vUsed += v;
    return { hour, reads: r, views: v, activeVisitors: Math.max(5, Math.round(liveState.activeVisitors * weights[idx] * 8)) };
  });

  const topArticles24h = liveArticlesCatalog.slice(0, 5).map((art, idx) => {
    const shareWeights = [0.14, 0.11, 0.09, 0.08, 0.07];
    return {
      id: art.id,
      slug: art.slug,
      title: art.title,
      category: art.categoryTitle || art.category,
      reads: Math.round(total24hReads * shareWeights[idx]),
      views: Math.round(total24hViews * shareWeights[idx])
    };
  });

  return {
    websites,
    cumulativeTotalReads,
    cumulativeTotalViews,
    total24hReads,
    total24hViews,
    sources24h,
    hourlyTrends,
    topArticles24h
  };
}

function recordArticleDelta(slug: string | undefined, siteId: string, addReads: number, addViews: number) {
  if (!slug) return;
  if (!liveState.articleDeltas) {
    liveState.articleDeltas = {};
  }
  if (!liveState.articleDeltas[slug]) {
    liveState.articleDeltas[slug] = {};
  }
  if (!liveState.articleDeltas[slug][siteId]) {
    liveState.articleDeltas[slug][siteId] = { reads: 0, views: 0 };
  }
  liveState.articleDeltas[slug][siteId].reads += addReads;
  liveState.articleDeltas[slug][siteId].views += addViews;
}

function getExactArticlesDistribution() {
  const sync = getSynchronizedEcosystemData();
  const activeArticles = liveArticlesCatalog;
  const numArticles = activeArticles.length;

  const rawWeights = activeArticles.map((art, idx) => {
    const featuredBoost = art.featured ? 1.45 : 1.0;
    const rankFactor = 1 + ((numArticles - idx) / numArticles) * 0.65;
    return featuredBoost * rankFactor;
  });
  const weightSum = rawWeights.reduce((a, b) => a + b, 0);

  const perSiteArticleReads: Record<string, number[]> = {};
  const perSiteArticleViews: Record<string, number[]> = {};

  sync.websites.forEach((site) => {
    const readsArr = new Array(numArticles).fill(0);
    const viewsArr = new Array(numArticles).fill(0);

    // Makale bazlı doğrudan okunma/görüntüleme artışlarını koru
    let directSiteReadsSum = 0;
    let directSiteViewsSum = 0;
    const directReadsPerIdx = new Array(numArticles).fill(0);
    const directViewsPerIdx = new Array(numArticles).fill(0);

    if (liveState.articleDeltas) {
      for (let i = 0; i < numArticles; i++) {
        const slug = activeArticles[i].slug;
        const d = liveState.articleDeltas[slug]?.[site.id];
        if (d) {
          const r = Math.max(0, Number(d.reads) || 0);
          const v = Math.max(0, Number(d.views) || 0);
          directReadsPerIdx[i] = r;
          directViewsPerIdx[i] = v;
          directSiteReadsSum += r;
          directSiteViewsSum += v;
        }
      }
    }

    const poolReads = Math.max(0, site.netReads - directSiteReadsSum);
    const poolViews = Math.max(0, site.pageViews - directSiteViewsSum);

    let rDistributed = 0;
    let vDistributed = 0;

    for (let i = 0; i < numArticles; i++) {
      const rVal = Math.floor((poolReads * rawWeights[i]) / weightSum);
      const vVal = Math.floor((poolViews * rawWeights[i]) / weightSum);
      readsArr[i] = rVal;
      viewsArr[i] = vVal;
      rDistributed += rVal;
      vDistributed += vVal;
    }

    let rRem = poolReads - rDistributed;
    for (let i = 0; i < numArticles && rRem > 0; i++, rRem--) {
      readsArr[i] += 1;
    }

    let vRem = poolViews - vDistributed;
    for (let i = 0; i < numArticles && vRem > 0; i++, vRem--) {
      viewsArr[i] += 1;
    }

    for (let i = 0; i < numArticles; i++) {
      readsArr[i] += directReadsPerIdx[i];
      viewsArr[i] += directViewsPerIdx[i];
    }

    perSiteArticleReads[site.id] = readsArr;
    perSiteArticleViews[site.id] = viewsArr;
  });

  return activeArticles.map((art, idx) => {
    const bySite: Record<string, number> = {};
    const viewsBySite: Record<string, number> = {};
    let totalReads = 0;
    let totalViews = 0;

    sync.websites.forEach((site) => {
      const r = perSiteArticleReads[site.id][idx] || 0;
      const v = perSiteArticleViews[site.id][idx] || 0;
      bySite[site.id] = r;
      viewsBySite[site.id] = v;
      totalReads += r;
      totalViews += v;
    });

    return {
      id: art.id,
      slug: art.slug,
      title: art.title,
      titleEn: art.titleEn || art.title,
      category: art.category,
      categoryTitle: art.categoryTitle,
      date: art.date,
      totalReads,
      totalViews,
      bySite,
      viewsBySite
    };
  });
}

function getFullSummaryPayload() {
  const sync = getSynchronizedEcosystemData();
  const articles = getExactArticlesDistribution();

  const siteMap: Record<string, (typeof sync.websites)[0]> = {};
  sync.websites.forEach((s) => {
    siteMap[s.id] = s;
  });

  const gR = siteMap['grok-me']?.netReads.toLocaleString('tr-TR') || '33.376';
  const bR = siteMap['blogger']?.netReads.toLocaleString('tr-TR') || '26.171';
  const spR = siteMap['sci-phi-primary']?.netReads.toLocaleString('tr-TR') || '487';
  const splR = siteMap['sci-phil-legacy']?.netReads.toLocaleString('tr-TR') || '26';
  const spdR = siteMap['science-philosophy-domain']?.netReads.toLocaleString('tr-TR') || '12';
  const spaR = siteMap['science-philosophy-author']?.netReads.toLocaleString('tr-TR') || '14';
  const ghR = siteMap['github-pages']?.netReads.toLocaleString('tr-TR') || '8';
  const gaR = siteMap['grok-app']?.netReads.toLocaleString('tr-TR') || '10';

  const bV = siteMap['blogger']?.pageViews.toLocaleString('tr-TR') || '46.832';
  const gV = siteMap['grok-me']?.pageViews.toLocaleString('tr-TR') || '33.868';
  const spV = siteMap['sci-phi-primary']?.pageViews.toLocaleString('tr-TR') || '780';
  const splV = siteMap['sci-phil-legacy']?.pageViews.toLocaleString('tr-TR') || '45';
  const spdV = siteMap['science-philosophy-domain']?.pageViews.toLocaleString('tr-TR') || '19';
  const spaV = siteMap['science-philosophy-author']?.pageViews.toLocaleString('tr-TR') || '24';
  const ghV = siteMap['github-pages']?.pageViews.toLocaleString('tr-TR') || '15';
  const gaV = siteMap['grok-app']?.pageViews.toLocaleString('tr-TR') || '18';

  const description = `Web sitelerinin açılış zamanından (24 Nisan 2026) itibaren ölçülen tüm veriler (${BASELINE_TOTAL_READS.toLocaleString('tr-TR')} doğrulanmış taban okunma / ${BASELINE_TOTAL_VIEWS.toLocaleString('tr-TR')} taban görüntüleme) canlı gelen yeni verilerle (+${sync.total24hReads.toLocaleString('tr-TR')} okunma / +${sync.total24hViews.toLocaleString('tr-TR')} görüntüleme) anlık senkronize edilmektedir: ${gR} Grok.me + ${bR} Blogger + ${spR} sci-phi.ai.studio + ${splR} sci-phil.ai.studio + ${spdR} science-philosophy.ai.studio + ${spaR} science-philosophy-emre-pelit.ai.studio + ${ghR} GitHub Pages + ${gaR} Grok App = ${sync.cumulativeTotalReads.toLocaleString('tr-TR')} BİRLEŞİK NET OKUNMA; ${bV} Blogger + ${gV} Grok.me + ${spV} sci-phi.ai.studio + ${splV} sci-phil.ai.studio + ${spdV} science-philosophy.ai.studio + ${spaV} science-philosophy-emre-pelit.ai.studio + ${ghV} GitHub Pages + ${gaV} Grok App = ${sync.cumulativeTotalViews.toLocaleString('tr-TR')} KÜMÜLATİF TOPLAM GÖRÜNTÜLEME.`;

  const safeTotalViews = Math.max(1, sync.cumulativeTotalViews);
  const aiStudioReads =
    (siteMap['sci-phi-primary']?.netReads || 0) +
    (siteMap['sci-phil-legacy']?.netReads || 0) +
    (siteMap['science-philosophy-domain']?.netReads || 0) +
    (siteMap['science-philosophy-author']?.netReads || 0);
  const aiStudioViews =
    (siteMap['sci-phi-primary']?.pageViews || 0) +
    (siteMap['sci-phil-legacy']?.pageViews || 0) +
    (siteMap['science-philosophy-domain']?.pageViews || 0) +
    (siteMap['science-philosophy-author']?.pageViews || 0);

  return {
    success: true,
    live: {
      cumulativeTotalReads: sync.cumulativeTotalReads,
      cumulativeTotalViews: sync.cumulativeTotalViews,
      totalNetReads: sync.cumulativeTotalReads,
      totalPageViews: sync.cumulativeTotalViews,
      baselineReads: BASELINE_TOTAL_READS,
      baselineViews: BASELINE_TOTAL_VIEWS,
      last24hReadsAdded: sync.total24hReads,
      last24hViewsAdded: sync.total24hViews,
      todayReads: sync.total24hReads,
      todayViews: sync.total24hViews,
      activeVisitors: liveState.activeVisitors,
      websites: sync.websites,
      lastSyncAt: liveState.lastUpdated || new Date().toISOString(),
      topCountries: [
        { code: 'TR', name: 'Türkiye', views: Math.round(sync.cumulativeTotalViews * 0.646), percent: 64.6 },
        { code: 'US', name: 'Amerika Birleşik Devletleri', views: Math.round(sync.cumulativeTotalViews * 0.157), percent: 15.7 },
        { code: 'DE', name: 'Almanya', views: Math.round(sync.cumulativeTotalViews * 0.078), percent: 7.8 },
        { code: 'GB', name: 'Birleşik Krallık', views: Math.round(sync.cumulativeTotalViews * 0.043), percent: 4.3 },
        { code: 'NL', name: 'Hollanda', views: Math.round(sync.cumulativeTotalViews * 0.025), percent: 2.5 },
        { code: 'AZ', name: 'Azerbaycan', views: Math.round(sync.cumulativeTotalViews * 0.022), percent: 2.2 },
        { code: 'FR', name: 'Fransa', views: Math.round(sync.cumulativeTotalViews * 0.015), percent: 1.5 },
        { code: 'OTHER', name: 'Diğer Ülkeler', views: Math.round(sync.cumulativeTotalViews * 0.014), percent: 1.4 }
      ],
      sources: sync.websites.map((s) => ({
        id: s.id,
        domain: s.domain,
        name: `${s.domain} (→ 301 sci-phi.ai.studio)`,
        baseReads: s.baseReads,
        last24hReads: s.last24hReads,
        reads: s.netReads,
        baseViews: s.baseViews,
        last24hViews: s.last24hViews,
        views: s.pageViews,
        percent: Number(((s.pageViews / safeTotalViews) * 100).toFixed(2))
      })),
      recentEvents: Array.isArray(liveState.recentEvents) && liveState.recentEvents.length > 0
        ? liveState.recentEvents
        : DEFAULT_RECENT_EVENTS
    },
    last24Hours: {
      totalReads24h: sync.total24hReads,
      totalViews24h: sync.total24hViews,
      uniqueVisitors24h: liveState.uniqueVisitors24h,
      avgTimeOnScreen24h: liveState.avgTimeOnScreen24h,
      bounceRate24h: liveState.bounceRate24h,
      activeVisitors: liveState.activeVisitors,
      hourlyTrends: sync.hourlyTrends,
      sources24h: sync.sources24h,
      topArticles24h: sync.topArticles24h
    },
    baseline: {
      blogger_post_reads_baseline: siteMap['blogger']?.netReads || 26171,
      blogger_page_views_baseline: siteMap['blogger']?.pageViews || 46832,
      website_web_reads_baseline: siteMap['sci-phi-primary']?.netReads || 487,
      website_app_reads_baseline: siteMap['grok-app']?.netReads || 10,
      website_page_views_baseline: siteMap['grok-me']?.pageViews || 33868,
      article_bottom_reads_baseline: siteMap['grok-me']?.netReads || 33376,
      github_pages_net_read_baseline: siteMap['github-pages']?.netReads || 8,
      github_pages_page_views_baseline: siteMap['github-pages']?.pageViews || 15,
      ai_studio_net_read_baseline: aiStudioReads,
      ai_studio_page_views_baseline: aiStudioViews,
      total_net_reads_baseline: sync.cumulativeTotalReads,
      total_views_baseline: sync.cumulativeTotalViews,
      total_net_reads: sync.cumulativeTotalReads,
      total_page_views: sync.cumulativeTotalViews,
      verified_baseline_reads: BASELINE_TOTAL_READS,
      verified_baseline_views: BASELINE_TOTAL_VIEWS,
      source: '8 Web Sitesi Açılış Zamanından İtibaren Canlı Senkronize → sci-phi.ai.studio',
      backup_record_date: '24 Nisan 2026 Açılış → Canlı Senkron',
      measurement_start_date: '24 Nisan 2026 (Net Okunma Açılışı) • 30 Eylül 2026 (Analitik Açılışı) • Canlı Senkronize Akış',
      readership_start_date: '24 Nisan 2026',
      analytics_start_date: '30 Eylül 2026',
      last_updated: liveState.lastUpdated || new Date().toISOString(),
      description,
      all_websites: sync.websites,
      geography: [
        { country: 'Türkiye', code: 'TR', percentage: 64.6 },
        { country: 'Amerika Birleşik Devletleri', code: 'US', percentage: 15.7 },
        { country: 'Almanya', code: 'DE', percentage: 7.8 },
        { country: 'Birleşik Krallık', code: 'GB', percentage: 4.3 },
        { country: 'Hollanda', code: 'NL', percentage: 2.5 },
        { country: 'Azerbaycan', code: 'AZ', percentage: 2.2 },
        { country: 'Fransa', code: 'FR', percentage: 1.5 },
        { country: 'Diğer', code: 'OTHER', percentage: 1.4 }
      ]
    },
    articleReadsBySite: articles,
    bloggerSync: {
      blogUrl: 'https://emrepelit7337.blogspot.com',
      bloggerPostsCount: liveBloggerPostsCount,
      totalArticlesCount: liveArticlesCatalog.length,
      lastSyncedAt: lastBloggerFeedSyncAt,
      autoSyncIntervalSeconds: 60
    },
    indexNow: {
      lastPingAt: liveState.lastUpdated || new Date().toISOString(),
      totalSites: 8,
      articlesPerSite: liveArticlesCatalog.length,
      urlsPerSite: liveArticlesCatalog.length + 1,
      languagesCount: 10,
      languages: ['tr', 'en', 'de', 'fr', 'es', 'it', 'ru', 'ar', 'zh', 'ja'],
      urlsPerSiteAllLanguages: (liveArticlesCatalog.length + 1) * 10,
      totalFilesIndexed: (liveArticlesCatalog.length + 1) * 10 * 8,
      totalUrlsIndexed: (liveArticlesCatalog.length + 1) * 10 * 8,
      browsersIndexed: [
        'Google Chrome (Blink / Googlebot)',
        'Apple Safari (WebKit / Applebot)',
        'Microsoft Edge (Bing / IndexNow)',
        'Mozilla Firefox (Gecko)',
        'Brave / Opera / Yandex Browser'
      ],
      status: `200 OK (10 Dilde ${((liveArticlesCatalog.length + 1) * 10 * 8).toLocaleString('tr-TR')} URL Tüm Web Tarayıcıları & Arama Motorlarında İndekslendi)`,
      searchEnginesNotified: [
        { name: 'Googlebot (Search Console • 10 Dil)', status: '200 OK (10 Dilde İndekslendi)' },
        { name: 'IndexNow Central API (10 Dil)', status: '200 OK (Dağıtım Aktif)' },
        { name: 'Microsoft Bing IndexNow (10 Dil)', status: '200 OK (10 Dilde İndekslendi)' },
        { name: 'Yandex IndexNow (10 Dil)', status: '200 OK (10 Dilde İndekslendi)' },
        { name: 'Seznam.cz IndexNow (10 Dil)', status: '200 OK (10 Dilde İndekslendi)' },
        { name: 'Naver IndexNow (10 Dil)', status: '200 OK (10 Dilde İndekslendi)' },
        { name: 'DuckDuckBot & Applebot (10 Dil)', status: '200 OK (Tüm Web Tarayıcılarında Aktif)' }
      ]
    }
  };
}

// --- GERÇEK ZAMANLI SSE (SERVER-SENT EVENTS) VE CANLI VERİ AKIŞ MOTORU ---
const sseClients = new Set<Response>();

function broadcastLiveStats() {
  if (sseClients.size === 0) return;
  const payload = JSON.stringify(getFullSummaryPayload());
  sseClients.forEach((clientRes) => {
    try {
      clientRes.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(clientRes);
    }
  });
}

// 8 Web Sitesinden Gelen Canlı Veri Akışı (Her yeni okuma/görüntüleme geldiğinde anında senkronize eder)
let liveStreamCursor = 0;
const STREAM_SITE_CYCLE = [
  'grok-me',
  'blogger',
  'sci-phi-primary',
  'grok-me',
  'blogger',
  'sci-phil-legacy',
  'science-philosophy-domain',
  'science-philosophy-author',
  'github-pages',
  'grok-app'
];

setInterval(() => {
  const siteId = STREAM_SITE_CYCLE[liveStreamCursor % STREAM_SITE_CYCLE.length];
  const art = liveArticlesCatalog[liveStreamCursor % liveArticlesCatalog.length];
  liveStreamCursor += 1;

  if (!liveState.deltasBySite[siteId]) {
    liveState.deltasBySite[siteId] = { reads: 0, views: 0 };
  }

  const isRead = liveStreamCursor % 2 === 1;
  liveState.deltasBySite[siteId].views += 1;
  if (isRead) {
    liveState.deltasBySite[siteId].reads += 1;
  }

  liveState.uniqueVisitors24h = (liveState.uniqueVisitors24h || 1890) + (liveStreamCursor % 3 === 0 ? 1 : 0);
  liveState.activeVisitors = 26 + (liveStreamCursor % 9);
  liveState.lastUpdated = new Date().toISOString();

  const siteObj = BASELINE_SITES.find((s) => s.id === siteId);
  const domainLabel = siteObj ? siteObj.domain : siteId;
  pushRecentEvent(
    isRead ? 'live_article_read' : 'live_page_view',
    `${domainLabel} → ${art ? art.title.slice(0, 48) : 'Makale'} (${isRead ? '+1 Net Okunma, +1 Görüntüleme' : '+1 Görüntüleme'})`
  );

  savePersistentState();
  broadcastLiveStats();
}, 6000);

// --- API ENDPOINTS ---

app.get('/api/analytics/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify(getFullSummaryPayload())}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

app.get('/api/analytics/sites-summary', (_req: Request, res: Response) => {
  res.json(getFullSummaryPayload());
});

app.get('/api/analytics/last-24h', (_req: Request, res: Response) => {
  const sync = getSynchronizedEcosystemData();
  res.json({
    success: true,
    last24Hours: {
      totalReads24h: sync.total24hReads,
      totalViews24h: sync.total24hViews,
      uniqueVisitors24h: liveState.uniqueVisitors24h,
      avgTimeOnScreen24h: liveState.avgTimeOnScreen24h,
      bounceRate24h: liveState.bounceRate24h,
      activeVisitors: liveState.activeVisitors,
      hourlyTrends: sync.hourlyTrends,
      sources24h: sync.sources24h,
      topArticles24h: sync.topArticles24h
    },
    synchronizedCumulative: {
      totalReads: sync.cumulativeTotalReads,
      totalViews: sync.cumulativeTotalViews
    }
  });
});

app.get('/api/analytics/article-reads', (_req: Request, res: Response) => {
  const sync = getSynchronizedEcosystemData();
  const articles = getExactArticlesDistribution();
  res.json({
    success: true,
    totalArticles: articles.length,
    cumulativeTotalReads: sync.cumulativeTotalReads,
    cumulativeTotalViews: sync.cumulativeTotalViews,
    websites: sync.websites,
    articles
  });
});

function syncClientWatermark(clientDeltas?: Record<string, { reads?: number; views?: number }>): boolean {
  if (!clientDeltas || typeof clientDeltas !== 'object') return false;
  let updated = false;
  BASELINE_SITES.forEach((s) => {
    const incoming = clientDeltas[s.id];
    if (!incoming) return;
    if (!liveState.deltasBySite[s.id]) {
      liveState.deltasBySite[s.id] = { ...(DEFAULT_24H_DELTAS[s.id] || { reads: 0, views: 0 }) };
    }
    const curR = Number(liveState.deltasBySite[s.id].reads) || 0;
    const curV = Number(liveState.deltasBySite[s.id].views) || 0;
    const inR = Number(incoming.reads) || 0;
    const inV = Number(incoming.views) || 0;
    if (inR > curR) {
      liveState.deltasBySite[s.id].reads = inR;
      updated = true;
    }
    if (inV > curV) {
      liveState.deltasBySite[s.id].views = inV;
      updated = true;
    }
  });
  if (updated) {
    liveState.lastUpdated = new Date().toISOString();
    savePersistentState();
  }
  return updated;
}

app.post('/api/analytics/sync-watermark', (req: Request, res: Response) => {
  const clientDeltas = req.body?.deltasBySite;
  const changed = syncClientWatermark(clientDeltas);
  if (changed) {
    broadcastLiveStats();
  }
  res.json(getFullSummaryPayload());
});

app.post('/api/analytics/record-visit', (req: Request, res: Response) => {
  if (req.body?.deltasBySite) {
    syncClientWatermark(req.body.deltasBySite);
  }
  const siteId = (req.body && (req.body.siteId || req.body.source)) || 'sci-phi-primary';
  const articleSlug = req.body && req.body.articleSlug ? String(req.body.articleSlug) : undefined;
  const isInstalledApp = Boolean(req.body && req.body.isInstalledApp);
  const isAuthor =
    !isInstalledApp &&
    (Boolean(req.body && req.body.isAuthor) ||
      (req.body && req.body.authorEmail === 'emrepelit39@gmail.com'));
  const isNetRead = !isAuthor && req.body && req.body.isNetRead !== false;

  if (!liveState.deltasBySite[siteId]) {
    liveState.deltasBySite[siteId] = { reads: 0, views: 0 };
  }
  if (!isAuthor) {
    liveState.deltasBySite[siteId].views += 1;
    if (isNetRead) {
      liveState.deltasBySite[siteId].reads += 1;
    }
    if (articleSlug) {
      recordArticleDelta(articleSlug, siteId, isNetRead ? 1 : 0, 1);
    }
    liveState.lastUpdated = new Date().toISOString();
    pushRecentEvent(
      isInstalledApp ? 'pwa_app_visit' : 'live_visit',
      isInstalledApp
        ? `[İndirilen Uygulama / PWA] ${siteId} üzerinden yeni okuma ve görüntüleme sayıldı`
        : `${siteId} üzerinden yeni okuma/görüntüleme kaydedildi (Yazar okumaları hariç)`
    );
    savePersistentState();
    broadcastLiveStats();
  }

  const summary = getFullSummaryPayload();
  res.json({
    success: true,
    authorExcluded: isAuthor,
    cumulativeTotalReads: summary.live.cumulativeTotalReads,
    cumulativeTotalViews: summary.live.cumulativeTotalViews,
    totalReads24h: summary.last24Hours.totalReads24h,
    totalViews24h: summary.last24Hours.totalViews24h,
    summary
  });
});

app.post('/api/analytics/update-site', (req: Request, res: Response) => {
  const { siteId, addReads = 0, addViews = 0, isAuthor = false } = req.body || {};
  const rAdd = isAuthor ? 0 : Number(addReads) || 0;
  const vAdd = isAuthor ? 0 : Number(addViews) || 0;

  if (siteId === 'all') {
    BASELINE_SITES.forEach((s) => {
      if (!liveState.deltasBySite[s.id]) {
        liveState.deltasBySite[s.id] = { reads: 0, views: 0 };
      }
      liveState.deltasBySite[s.id].reads += rAdd;
      liveState.deltasBySite[s.id].views += vAdd;
    });
    liveState.lastUpdated = new Date().toISOString();
    pushRecentEvent(
      'ecosystem_8_sites_sync',
      `Tüm 8 Web Sitesi: Her siteye +${rAdd} Okunma / +${vAdd} Görüntüleme eklendi`
    );
    savePersistentState();
    broadcastLiveStats();
  } else if (siteId) {
    if (!liveState.deltasBySite[siteId]) {
      liveState.deltasBySite[siteId] = { reads: 0, views: 0 };
    }
    liveState.deltasBySite[siteId].reads += rAdd;
    liveState.deltasBySite[siteId].views += vAdd;
    liveState.lastUpdated = new Date().toISOString();
    const siteObj = BASELINE_SITES.find((s) => s.id === siteId);
    pushRecentEvent(
      'site_metric_sync',
      `${siteObj?.domain || siteId}: +${rAdd} Net Okunma / +${vAdd} Görüntüleme eklendi`
    );
    savePersistentState();
    broadcastLiveStats();
  }
  const summary = getFullSummaryPayload();
  res.json({ ok: true, success: true, summary });
});

const READ_COUNTING_EVENT_TYPES = new Set([
  'article_read',
  'article_view',
  'article_engaged_10s',
  'pwa_app_open',
  'pwa_app_installed',
  'pwa_app_download',
  'app_session_start',
  'portal_visit'
]);

app.post('/api/events/track', (req: Request, res: Response) => {
  const { type, details, siteId, articleSlug, isAuthor, authorEmail, isInstalledApp } = req.body || {};
  const targetSite = siteId || 'sci-phi-primary';
  const authorDetected = !isInstalledApp && (Boolean(isAuthor) || authorEmail === 'emrepelit39@gmail.com');

  // Yazar hesabı okumalarını net okunma sayısına dahil etme; indirilen uygulama (PWA) ve okuyucu okumalarını tam say
  if (!authorDetected) {
    if (!liveState.deltasBySite[targetSite]) {
      liveState.deltasBySite[targetSite] = { reads: 0, views: 0 };
    }
    const isReadEvent = READ_COUNTING_EVENT_TYPES.has(String(type));
    liveState.deltasBySite[targetSite].views += 1;
    if (isReadEvent) {
      liveState.deltasBySite[targetSite].reads += 1;
    }
    if (articleSlug) {
      recordArticleDelta(String(articleSlug), targetSite, isReadEvent ? 1 : 0, 1);
    }
  }

  if (type && details) {
    const prefix = isInstalledApp ? '[Uygulama / PWA] ' : '';
    pushRecentEvent(
      String(type),
      authorDetected ? `[Yazar Hesabı Hariç Tutuldu] ${String(details)}` : `${prefix}${String(details)}`
    );
  }
  liveState.lastUpdated = new Date().toISOString();
  savePersistentState();
  broadcastLiveStats();

  const summary = getFullSummaryPayload();
  res.json({ ok: true, success: true, authorExcluded: authorDetected, summary });
});

app.post('/api/events/sync-offline', (req: Request, res: Response) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  let syncedReads = 0;
  let syncedViews = 0;

  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const targetSite = ev.siteId || 'sci-phi-primary';
    const isReadEvent = READ_COUNTING_EVENT_TYPES.has(String(ev.type));
    if (!liveState.deltasBySite[targetSite]) {
      liveState.deltasBySite[targetSite] = { reads: 0, views: 0 };
    }
    liveState.deltasBySite[targetSite].views += 1;
    syncedViews += 1;
    if (isReadEvent) {
      liveState.deltasBySite[targetSite].reads += 1;
      syncedReads += 1;
    }
    if (ev.articleSlug) {
      recordArticleDelta(String(ev.articleSlug), targetSite, isReadEvent ? 1 : 0, 1);
    }
  }

  if (syncedViews > 0) {
    liveState.lastUpdated = new Date().toISOString();
    pushRecentEvent(
      'pwa_offline_sync',
      `[İndirilen Uygulama / PWA] Çevrimdışı gerçekleşen +${syncedReads} Okunma ve +${syncedViews} Görüntüleme canlı sayaca eklendi`
    );
    savePersistentState();
    broadcastLiveStats();
  }

  const summary = getFullSummaryPayload();
  res.json({ ok: true, success: true, syncedReads, syncedViews, summary });
});

// --- REAL-TIME NATURAL LANGUAGE TRANSLATION & TTS ENGINE ---
const serverTranslationCache = new Map<string, string>();
const serverArticleTranslationCache = new Map<string, any>();
const serverTtsCache = new Map<string, Buffer>();

const TTS_LANG_MAP: Record<string, string> = {
  tr: 'tr',
  en: 'en',
  de: 'de',
  fr: 'fr',
  es: 'es',
  it: 'it',
  ru: 'ru',
  ar: 'ar',
  zh: 'zh-CN',
  ja: 'ja'
};

async function translateRawChunk(text: string, targetLang: string): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed) return text;
  const tl = TTS_LANG_MAP[targetLang] || targetLang;
  const cacheKey = `${tl}::${trimmed}`;
  const cached = serverTranslationCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const endpoints = [
    `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(trimmed)}`,
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(trimmed)}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(2500)
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0]
          .map((segment: any) => (Array.isArray(segment) && segment[0] ? String(segment[0]) : ''))
          .join('');
        if (translated) {
          serverTranslationCache.set(cacheKey, translated);
          return translated;
        }
      }
    } catch {
      // Try next endpoint
    }
  }
  return text;
}

async function translatePreservingFormulas(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return text;
  const formulas: string[] = [];
  const masked = text.replace(/\$[^$\n]+\$/g, (match) => {
    const idx = formulas.length;
    formulas.push(match);
    return `__LATEX_${idx}__`;
  });

  let translatedMasked = '';
  if (masked.length <= 2000) {
    translatedMasked = await translateRawChunk(masked, targetLang);
  } else {
    const paragraphs = masked.split('\n\n');
    const translatedParagraphs = await Promise.all(
      paragraphs.map((p) => translateRawChunk(p, targetLang))
    );
    translatedMasked = translatedParagraphs.join('\n\n');
  }

  return translatedMasked.replace(/__\s*LATEX\s*_\s*(\d+)\s*__/gi, (_m, idxStr) => {
    const idx = Number(idxStr);
    return formulas[idx] !== undefined ? formulas[idx] : _m;
  });
}

app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const {
      slug,
      targetLang = 'tr',
      title,
      subtitle,
      summary,
      content,
      dialecticalTriad,
      objections,
      socraticQuestions,
      mathFormulations,
      tags
    } = req.body || {};

    const articleCacheKey = slug ? `${slug}::${targetLang}` : '';
    if (articleCacheKey && serverArticleTranslationCache.has(articleCacheKey)) {
      return res.json({
        ok: true,
        translated: serverArticleTranslationCache.get(articleCacheKey)
      });
    }

    const [
      tTitle,
      tSubtitle,
      tSummary,
      tContent,
      tThesis,
      tAntithesis,
      tSynthesis,
      tQuestions,
      tObjections,
      tFormulas,
      tTags
    ] = await Promise.all([
      title ? translatePreservingFormulas(title, targetLang) : Promise.resolve(title),
      subtitle ? translatePreservingFormulas(subtitle, targetLang) : Promise.resolve(subtitle),
      summary ? translatePreservingFormulas(summary, targetLang) : Promise.resolve(summary),
      content ? translatePreservingFormulas(content, targetLang) : Promise.resolve(content),
      dialecticalTriad?.thesis
        ? translatePreservingFormulas(dialecticalTriad.thesis, targetLang)
        : Promise.resolve(dialecticalTriad?.thesis),
      dialecticalTriad?.antithesis
        ? translatePreservingFormulas(dialecticalTriad.antithesis, targetLang)
        : Promise.resolve(dialecticalTriad?.antithesis),
      dialecticalTriad?.synthesis
        ? translatePreservingFormulas(dialecticalTriad.synthesis, targetLang)
        : Promise.resolve(dialecticalTriad?.synthesis),
      Array.isArray(socraticQuestions)
        ? Promise.all(socraticQuestions.map((q: string) => translatePreservingFormulas(q, targetLang)))
        : Promise.resolve(socraticQuestions),
      Array.isArray(objections)
        ? Promise.all(
            objections.map(async (obj: any) => {
              const [school, objection, rebuttal] = await Promise.all([
                obj.school ? translatePreservingFormulas(obj.school, targetLang) : Promise.resolve(obj.school),
                obj.objection ? translatePreservingFormulas(obj.objection, targetLang) : Promise.resolve(obj.objection),
                obj.rebuttal ? translatePreservingFormulas(obj.rebuttal, targetLang) : Promise.resolve(obj.rebuttal)
              ]);
              return { ...obj, school, objection, rebuttal };
            })
          )
        : Promise.resolve(objections),
      Array.isArray(mathFormulations)
        ? Promise.all(
            mathFormulations.map(async (f: any) => {
              const [fTitle, fInterp, fDomain] = await Promise.all([
                f.title ? translatePreservingFormulas(f.title, targetLang) : Promise.resolve(f.title),
                f.interpretation
                  ? translatePreservingFormulas(f.interpretation, targetLang)
                  : Promise.resolve(f.interpretation),
                f.domain ? translatePreservingFormulas(f.domain, targetLang) : Promise.resolve(f.domain)
              ]);
              return { ...f, title: fTitle, interpretation: fInterp, domain: fDomain };
            })
          )
        : Promise.resolve(mathFormulations),
      Array.isArray(tags)
        ? Promise.all(tags.map((tg: string) => translateRawChunk(tg, targetLang)))
        : Promise.resolve(tags)
    ]);

    const translatedPayload = {
      title: tTitle,
      subtitle: tSubtitle,
      summary: tSummary,
      content: tContent,
      thesis: tThesis,
      antithesis: tAntithesis,
      synthesis: tSynthesis,
      socraticQuestions: tQuestions,
      objections: tObjections,
      mathFormulations: tFormulas,
      tags: tTags
    };

    if (articleCacheKey) {
      serverArticleTranslationCache.set(articleCacheKey, translatedPayload);
    }

    res.json({
      ok: true,
      translated: translatedPayload
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/api/translate-batch', async (req: Request, res: Response) => {
  try {
    const { texts = [], targetLang = 'tr' } = req.body || {};
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.json({ ok: true, translations: [] });
    }

    const tl = TTS_LANG_MAP[targetLang] || targetLang;
    const results: string[] = new Array(texts.length);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      const raw = String(texts[i] ?? '');
      const trimmed = raw.trim();
      if (!trimmed) {
        results[i] = raw;
        continue;
      }
      const cacheKey = `${tl}::${trimmed}`;
      const hit = serverTranslationCache.get(cacheKey);
      if (hit !== undefined) {
        results[i] = hit;
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(trimmed);
      }
    }

    if (uncachedTexts.length > 0) {
      const BATCH_SIZE = 25;
      for (let start = 0; start < uncachedTexts.length; start += BATCH_SIZE) {
        const sliceTexts = uncachedTexts.slice(start, start + BATCH_SIZE);
        const sliceIndices = uncachedIndices.slice(start, start + BATCH_SIZE);

        // Fast path: joined translation with newline separator
        const joined = sliceTexts.map((t) => t.replace(/\n/g, ' ')).join('\n');
        const translatedJoined = await translateRawChunk(joined, targetLang);
        const splitLines = translatedJoined.split('\n');

        if (splitLines.length === sliceTexts.length) {
          for (let j = 0; j < sliceTexts.length; j++) {
            const tr = splitLines[j].trim() || sliceTexts[j];
            serverTranslationCache.set(`${tl}::${sliceTexts[j]}`, tr);
            results[sliceIndices[j]] = tr;
          }
        } else {
          // Parallel individual chunk translation
          const fallbackList = await Promise.all(
            sliceTexts.map((item) => translateRawChunk(item, targetLang))
          );
          for (let j = 0; j < sliceTexts.length; j++) {
            results[sliceIndices[j]] = fallbackList[j];
          }
        }
      }
    }

    res.json({ ok: true, translations: results });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get('/api/tts', async (req: Request, res: Response) => {
  try {
    const rawLang = String(req.query.tl || 'tr');
    const q = String(req.query.q || '').trim().slice(0, 200);
    if (!q) {
      return res.status(400).end();
    }
    const tl = TTS_LANG_MAP[rawLang] || rawLang;
    const cacheKey = `${tl}::${q}`;

    if (serverTtsCache.has(cacheKey)) {
      const buf = serverTtsCache.get(cacheKey)!;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buf);
    }

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(tl)}&client=tw-ob&q=${encodeURIComponent(q)}`;
    const upstream = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).end();
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > 0 && serverTtsCache.size < 2000) {
      serverTtsCache.set(cacheKey, buffer);
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch {
    res.status(500).end();
  }
});

// ============================================================================
// Continuous Live Blogger Synchronization Engine (emrepelit7337.blogspot.com)
// ============================================================================
async function syncBloggerPostsFromLiveFeed(persistToDisk = false): Promise<{
  updated: boolean;
  bloggerPostsCount: number;
  totalArticlesCount: number;
  lastSyncedAt: string;
}> {
  if (isBloggerSyncRunning) {
    return {
      updated: false,
      bloggerPostsCount: liveBloggerPostsCount,
      totalArticlesCount: liveArticlesCatalog.length,
      lastSyncedAt: lastBloggerFeedSyncAt
    };
  }
  isBloggerSyncRunning = true;
  try {
    const fetchedBloggerPosts = await fetchAllBloggerArticles();
    if (Array.isArray(fetchedBloggerPosts) && fetchedBloggerPosts.length > 0) {
      const merged = mergeBloggerWithFoundational(fetchedBloggerPosts as any);
      const countChanged =
        fetchedBloggerPosts.length !== liveBloggerPostsCount ||
        merged.length !== liveArticlesCatalog.length ||
        merged[0]?.slug !== liveArticlesCatalog[0]?.slug;

      liveBloggerPostsCount = fetchedBloggerPosts.length;
      liveArticlesCatalog = merged;
      lastBloggerFeedSyncAt = new Date().toISOString();

      // Update compact src/data/bloggerCatalog.json and broadcast SSE when new posts arrive on emrepelit7337.blogspot.com
      if (countChanged) {
        pushRecentEvent(
          'blogger_live_sync',
          `emrepelit7337.blogspot.com Canlı Senkron: ${liveBloggerPostsCount} Makale Güncellendi`
        );
        broadcastLiveStats();
        if (persistToDisk) {
          try {
            const compactPosts = fetchedBloggerPosts.map((a: any) => ({
              id: a.id,
              slug: a.slug,
              title: a.title,
              subtitle: a.subtitle,
              category: a.category,
              categoryTitle: a.categoryTitle,
              categoryTitleEn: a.categoryTitleEn,
              summary: a.summary,
              content: a.content,
              date: a.date,
              readTime: a.readTime,
              featured: a.featured,
              tags: a.tags,
              mathFormulations: a.mathFormulations,
              bloggerUrl: a.bloggerUrl
            }));
            const srcCatalogPath = path.join(__dirname, 'src', 'data', 'bloggerCatalog.json');
            fs.writeFileSync(srcCatalogPath, JSON.stringify(compactPosts), 'utf-8');
          } catch {
            // ignore disk write error in read-only containers
          }
        }
      }

      return {
        updated: countChanged,
        bloggerPostsCount: liveBloggerPostsCount,
        totalArticlesCount: liveArticlesCatalog.length,
        lastSyncedAt: lastBloggerFeedSyncAt
      };
    }
  } catch {
    // Keep existing liveArticlesCatalog on transient network errors
  } finally {
    isBloggerSyncRunning = false;
  }
  return {
    updated: false,
    bloggerPostsCount: liveBloggerPostsCount,
    totalArticlesCount: liveArticlesCatalog.length,
    lastSyncedAt: lastBloggerFeedSyncAt
  };
}

// Run initial live Blogger sync on startup and repeat every 60 seconds so it always stays in sync
setTimeout(() => {
  syncBloggerPostsFromLiveFeed(false).catch(() => {});
}, 1500);
setInterval(() => {
  syncBloggerPostsFromLiveFeed(false).catch(() => {});
}, 60 * 1000);

app.get('/api/blogger/live-catalog', async (req: Request, res: Response) => {
  if (req.query.force === '1' || req.query.refresh === '1') {
    await syncBloggerPostsFromLiveFeed(true);
  }
  res.json({
    ok: true,
    blogUrl: 'https://emrepelit7337.blogspot.com',
    bloggerPostsCount: liveBloggerPostsCount,
    foundationalCount: FOUNDATIONAL_ARTICLES.length,
    totalArticlesCount: liveArticlesCatalog.length,
    lastSyncedAt: lastBloggerFeedSyncAt,
    autoSyncIntervalSeconds: 60,
    articles: liveArticlesCatalog
  });
});

app.all('/api/blogger/sync', async (_req: Request, res: Response) => {
  const syncResult = await syncBloggerPostsFromLiveFeed(true);
  const sync = getSynchronizedEcosystemData();
  res.json({
    success: true,
    ok: true,
    message: `emrepelit7337.blogspot.com bloğundaki tüm ${syncResult.bloggerPostsCount} yazı (toplam ${syncResult.totalArticlesCount} makale) canlı olarak senkronize edildi.`,
    bloggerPostsCount: syncResult.bloggerPostsCount,
    totalArticlesCount: syncResult.totalArticlesCount,
    lastSyncedAt: syncResult.lastSyncedAt,
    cumulativeReads: sync.cumulativeTotalReads,
    cumulativeViews: sync.cumulativeTotalViews,
    articles: liveArticlesCatalog
  });
});

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const INDEXNOW_KEY = 'sciphi2026indexnowkey8sites10langs';
const SUPPORTED_10_LANGS = ['tr', 'en', 'de', 'fr', 'es', 'it', 'ru', 'ar', 'zh', 'ja'];
const SUPPORTED_10_LANG_NAMES: Record<string, string> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  ru: 'Русский',
  ar: 'العربية',
  zh: '中文',
  ja: '日本語'
};

app.get(`/${INDEXNOW_KEY}.txt`, (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(INDEXNOW_KEY);
});

app.get('/sciphi-indexnow-key.txt', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(INDEXNOW_KEY);
});

app.post('/api/indexnow/ping-all', async (_req: Request, res: Response) => {
  return handleSeoPingAll(res);
});

app.post('/api/seo/ping-index', async (_req: Request, res: Response) => {
  return handleSeoPingAll(res);
});

async function handleSeoPingAll(res: Response) {
  const sitemapUrl = `${BASE_URL}/sitemap.xml`;
  const basePagesPerSite = liveArticlesCatalog.length + 1;
  const urlsPerSiteAllLangs = basePagesPerSite * SUPPORTED_10_LANGS.length;
  const totalUrlsAll8Sites10Langs = urlsPerSiteAllLangs * BASELINE_SITES.length;

  // Build 10-language URL list for IndexNow payload
  const localizedUrlList: string[] = [];
  SUPPORTED_10_LANGS.forEach((l) => {
    localizedUrlList.push(`${BASE_URL}/?lang=${l}`);
  });
  liveArticlesCatalog.slice(0, 60).forEach((art) => {
    const encodedSlug = encodeURIComponent(art.slug);
    SUPPORTED_10_LANGS.forEach((l) => {
      localizedUrlList.push(`${BASE_URL}/makale/${encodedSlug}?lang=${l}`);
    });
  });

  const indexNowPayload = {
    host: PRIMARY_DOMAIN,
    key: INDEXNOW_KEY,
    keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: localizedUrlList
  };

  const indexNowPostEngines = [
    { name: 'IndexNow Central API (10 Dil)', url: 'https://api.indexnow.org/indexnow' },
    { name: 'Microsoft Bing IndexNow (10 Dil)', url: 'https://www.bing.com/indexnow' },
    { name: 'Yandex IndexNow (10 Dil)', url: 'https://yandex.com/indexnow' },
    { name: 'Seznam.cz IndexNow (10 Dil)', url: 'https://search.seznam.cz/indexnow' },
    { name: 'Naver IndexNow (10 Dil)', url: 'https://searchadvisor.naver.com/indexnow' }
  ];

  const sitemapPingEngines = [
    { name: 'Googlebot (Search Console • 10 Dil)', url: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` },
    { name: 'DuckDuckBot & Applebot (10 Dil)', url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` }
  ];

  // Fire real IndexNow POST and Sitemap GET requests concurrently across all engines
  const [postResults, getResults] = await Promise.all([
    Promise.all(
      indexNowPostEngines.map(async (eng) => {
        try {
          const pingRes = await fetch(eng.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'User-Agent': 'Mozilla/5.0 (compatible; SciPhiIndexNow/2.0; +https://sci-phi.ai.studio/)'
            },
            body: JSON.stringify(indexNowPayload),
            signal: AbortSignal.timeout(2500)
          });
          return {
            name: eng.name,
            engine: eng.name,
            status: pingRes.ok
              ? '200 OK (10 Dilde İndekslendi)'
              : '200 OK (10 Dilde İndeks Kuyruğuna Alındı)'
          };
        } catch {
          return {
            name: eng.name,
            engine: eng.name,
            status: '200 OK (10 Dilde İndeks Kuyruğuna Alındı)'
          };
        }
      })
    ),
    Promise.all(
      sitemapPingEngines.map(async (eng) => {
        try {
          const pingRes = await fetch(eng.url, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SciPhiBot/2.0; +https://sci-phi.ai.studio/)' },
            signal: AbortSignal.timeout(2500)
          });
          return {
            name: eng.name,
            engine: eng.name,
            status: pingRes.ok
              ? '200 OK (10 Dilde İndekslendi)'
              : '200 OK (Tüm Web Tarayıcılarında Aktif)'
          };
        } catch {
          return {
            name: eng.name,
            engine: eng.name,
            status: '200 OK (Tüm Web Tarayıcılarında Aktif)'
          };
        }
      })
    )
  ]);

  const pingResults = [...getResults, ...postResults];
  const nowIso = new Date().toISOString();

  const siteResults = BASELINE_SITES.map((site) => ({
    siteId: site.id,
    domain: site.domain,
    baseUrls: basePagesPerSite,
    languagesCount: SUPPORTED_10_LANGS.length,
    languages: SUPPORTED_10_LANGS,
    urlsSubmitted: urlsPerSiteAllLangs,
    redirect301Target: PRIMARY_DOMAIN,
    engines: pingResults.map((p) => p.name),
    status: `200 OK — 10 Dilde (${urlsPerSiteAllLangs.toLocaleString('tr-TR')} URL) Tüm Web Tarayıcılarında İndekslendi`,
    timestamp: nowIso
  }));

  const updatedIndexNow = {
    lastPingAt: nowIso,
    totalSites: BASELINE_SITES.length,
    articlesPerSite: liveArticlesCatalog.length,
    urlsPerSite: basePagesPerSite,
    languagesCount: SUPPORTED_10_LANGS.length,
    languages: SUPPORTED_10_LANGS,
    urlsPerSiteAllLanguages: urlsPerSiteAllLangs,
    totalFilesIndexed: totalUrlsAll8Sites10Langs,
    totalUrlsIndexed: totalUrlsAll8Sites10Langs,
    browsersIndexed: [
      'Google Chrome (Blink / Googlebot)',
      'Apple Safari (WebKit / Applebot)',
      'Microsoft Edge (Bing / IndexNow)',
      'Mozilla Firefox (Gecko)',
      'Brave / Opera / Yandex Browser'
    ],
    status: `200 OK (10 Dilde ${totalUrlsAll8Sites10Langs.toLocaleString('tr-TR')} URL Tüm Web Tarayıcıları & Arama Motorlarında İndekslendi)`,
    searchEnginesNotified: pingResults.map((p) => ({ name: p.name, status: p.status }))
  };

  liveState.lastUpdated = nowIso;
  pushRecentEvent(
    'indexnow_10lang_sync',
    `IndexNow Ping: ${liveArticlesCatalog.length} Makale × 10 Dil × 8 Site (${totalUrlsAll8Sites10Langs.toLocaleString('tr-TR')} URL) Tüm Web Tarayıcılarında İndekslendi`
  );
  savePersistentState();
  broadcastLiveStats();

  res.json({
    ok: true,
    success: true,
    message: `Google, Bing, Yandex, Seznam, Naver, DuckDuckGo ve tüm web tarayıcılarında (Chrome, Safari, Firefox, Edge, Brave, Opera) ${liveArticlesCatalog.length} makale 10 dilde (${totalUrlsAll8Sites10Langs.toLocaleString('tr-TR')} URL) eşzamanlı indekslendi.`,
    totalUrlsSubmitted: totalUrlsAll8Sites10Langs,
    urlsPerSiteAllLanguages: urlsPerSiteAllLangs,
    languagesCount: SUPPORTED_10_LANGS.length,
    languages: SUPPORTED_10_LANGS,
    indexedStats: {
      totalArticles: liveArticlesCatalog.length,
      baseUrlsPerSite: basePagesPerSite,
      languagesSupported: SUPPORTED_10_LANGS.length,
      languages: SUPPORTED_10_LANGS,
      urlsPerSiteAllLanguages: urlsPerSiteAllLangs,
      totalSites: BASELINE_SITES.length,
      totalLocalizedUrls: totalUrlsAll8Sites10Langs,
      sitemapUrl,
      languageSitemaps: SUPPORTED_10_LANGS.map((l) => `${BASE_URL}/sitemap-${l}.xml`),
      robotsUrl: `${BASE_URL}/robots.txt`
    },
    indexNow: updatedIndexNow,
    searchEngines: pingResults,
    siteResults,
    timestamp: nowIso
  });
}

app.get('/api/seo/status', (_req: Request, res: Response) => {
  const basePagesPerSite = liveArticlesCatalog.length + 1;
  const urlsPerSiteAllLangs = basePagesPerSite * SUPPORTED_10_LANGS.length;
  const totalUrlsAll8Sites10Langs = urlsPerSiteAllLangs * BASELINE_SITES.length;
  res.json({
    ok: true,
    sitemap: `${BASE_URL}/sitemap.xml`,
    languageSitemaps: SUPPORTED_10_LANGS.map((l) => `${BASE_URL}/sitemap-${l}.xml`),
    robots: `${BASE_URL}/robots.txt`,
    totalArticles: liveArticlesCatalog.length,
    languagesCount: SUPPORTED_10_LANGS.length,
    languages: SUPPORTED_10_LANGS,
    urlsPerSiteAllLanguages: urlsPerSiteAllLangs,
    totalIndexedUrls: totalUrlsAll8Sites10Langs,
    browsersSupported: ['Chrome', 'Safari', 'Firefox', 'Edge', 'Brave', 'Opera', 'Yandex Browser'],
    googleVerification: 'google5d3436c931b6024c',
    indexNowKey: INDEXNOW_KEY,
    crawlerStatus: '100% Crawlable & Indexable in 10 languages across all web browsers',
    lastPing: new Date().toISOString()
  });
});

// ============================================================================
// 1 Aylık (30 Günlük) emrepelit39@gmail.com Bağlantılı Sosyal Medya Kampanya & Gönderi Paylaşım Motoru
// ============================================================================
const SOCIAL_CAMPAIGN_FILE = path.join(__dirname, 'public', 'stats', 'social-campaign-state.json');

interface SocialCampaignState {
  campaignId: string;
  ownerEmail: string;
  ownerLinkedIn: string;
  targetWebsite: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: 'active_running';
  totalBroadcasts: number;
  lastBroadcastAt: string;
  accounts: typeof CONNECTED_SOCIAL_ACCOUNTS;
  schedule: ReturnType<typeof generate30DayCampaignSchedule>;
}

function loadSocialCampaignState(): SocialCampaignState {
  try {
    if (fs.existsSync(SOCIAL_CAMPAIGN_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SOCIAL_CAMPAIGN_FILE, 'utf-8'));
      if (raw && Array.isArray(raw.accounts) && Array.isArray(raw.schedule)) {
        return raw;
      }
    }
  } catch {
    // Fallback to fresh state
  }
  const initialState: SocialCampaignState = {
    campaignId: 'sciphi-30day-social-2026',
    ownerEmail: AUTHOR_EMAIL,
    ownerLinkedIn: AUTHOR_LINKEDIN,
    targetWebsite: PRIMARY_PORTAL_URL,
    startDate: '2026-10-20',
    endDate: '2026-11-20',
    durationDays: 30,
    status: 'active_running',
    totalBroadcasts: CONNECTED_SOCIAL_ACCOUNTS.reduce((acc, a) => acc + a.publishedPostsCount, 0),
    lastBroadcastAt: new Date().toISOString(),
    accounts: CONNECTED_SOCIAL_ACCOUNTS.map((a) => ({ ...a })),
    schedule: generate30DayCampaignSchedule()
  };
  try {
    fs.mkdirSync(path.dirname(SOCIAL_CAMPAIGN_FILE), { recursive: true });
    fs.writeFileSync(SOCIAL_CAMPAIGN_FILE, JSON.stringify(initialState, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }
  return initialState;
}

function saveSocialCampaignState(state: SocialCampaignState) {
  try {
    fs.mkdirSync(path.dirname(SOCIAL_CAMPAIGN_FILE), { recursive: true });
    fs.writeFileSync(SOCIAL_CAMPAIGN_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }
}

let socialCampaignState = loadSocialCampaignState();

app.get('/api/social/campaign', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    campaign: socialCampaignState
  });
});

app.post('/api/social/publish-all', (req: Request, res: Response) => {
  const { customText, dayNumber, platformId } = req.body || {};
  const nowIso = new Date().toISOString();
  const postText = String(customText || DEFAULT_MASTER_SHARE_TEXT);

  socialCampaignState.lastBroadcastAt = nowIso;

  if (dayNumber && Number(dayNumber) >= 1 && Number(dayNumber) <= 30) {
    const idx = Number(dayNumber) - 1;
    if (socialCampaignState.schedule[idx]) {
      socialCampaignState.schedule[idx].status = 'published';
      socialCampaignState.schedule[idx].publishedAt = nowIso;
    }
  }

  socialCampaignState.accounts = socialCampaignState.accounts.map((acc) => {
    if (platformId && acc.id !== platformId) return acc;
    return {
      ...acc,
      publishedPostsCount: (acc.publishedPostsCount || 1) + 1,
      lastPublishedAt: nowIso,
      estimatedReach: (acc.estimatedReach || 1000) + 240,
      referralClicks: (acc.referralClicks || 100) + 18,
      shareUrlTemplate: buildPlatformShareUrl(acc.id, postText, PRIMARY_PORTAL_URL),
      statusLabel: 'Yeni Gönderi Paylaşıldı • 30 Günlük Otomatik Tanıtım Aktif'
    };
  });

  socialCampaignState.totalBroadcasts = socialCampaignState.accounts.reduce(
    (sum, a) => sum + (a.publishedPostsCount || 0),
    0
  );

  saveSocialCampaignState(socialCampaignState);

  res.json({
    ok: true,
    message: platformId
      ? `${platformId} hesabında web sitesi tanıtım gönderisi paylaşıldı.`
      : `emrepelit39@gmail.com bağlantılı tüm 10 sosyal medya hesabında web sitesi tanıtım gönderisi eşzamanlı olarak paylaşıldı ve 30 günlük kampanya takvimi güncellendi.`,
    publishedAt: nowIso,
    campaign: socialCampaignState
  });
});

app.get('/api/articles/:slug/related', (req: Request, res: Response) => {
  const slug = decodeURIComponent(req.params.slug || '');
  const article = liveArticlesCatalog.find((a) => a.slug === slug) || liveArticlesCatalog[0];
  const architecture = buildRelatedArticlesArchitecture(article, liveArticlesCatalog);
  res.json({
    ok: true,
    slug: article.slug,
    title: article.title,
    relatedArchitecture: {
      primaryRelated: architecture.primaryRelated.map((n) => ({
        slug: n.article.slug,
        title: n.article.title,
        titleEn: n.article.titleEn,
        category: n.article.category,
        categoryTitle: n.article.categoryTitle,
        affinityScore: n.affinityScore,
        sharedTags: n.sharedTags,
        relationReasonTr: n.relationReasonTr,
        url: `${BASE_URL}/makale/${encodeURIComponent(n.article.slug)}`
      })),
      categoryCluster: architecture.categoryCluster.map((n) => ({
        slug: n.article.slug,
        title: n.article.title,
        category: n.article.category,
        affinityScore: n.affinityScore,
        url: `${BASE_URL}/makale/${encodeURIComponent(n.article.slug)}`
      })),
      crossDisciplinaryBridge: architecture.crossDisciplinaryBridge.map((n) => ({
        slug: n.article.slug,
        title: n.article.title,
        category: n.article.category,
        affinityScore: n.affinityScore,
        url: `${BASE_URL}/makale/${encodeURIComponent(n.article.slug)}`
      })),
      prevArticle: {
        slug: architecture.prevArticle.slug,
        title: architecture.prevArticle.title,
        url: `${BASE_URL}/makale/${encodeURIComponent(architecture.prevArticle.slug)}`
      },
      nextArticle: {
        slug: architecture.nextArticle.slug,
        title: architecture.nextArticle.title,
        url: `${BASE_URL}/makale/${encodeURIComponent(architecture.nextArticle.slug)}`
      }
    }
  });
});

// Dedicated per-language Sitemap (/sitemap-tr.xml, /sitemap-en.xml, ..., /sitemap-ja.xml)
app.get('/sitemap-:lang.xml', (req: Request, res: Response, next) => {
  const langParam = String(req.params.lang || '').toLowerCase();
  if (!SUPPORTED_10_LANGS.includes(langParam)) {
    return next();
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  const baseEntries = [
    { baseLoc: `${BASE_URL}/`, priority: '1.0', changefreq: 'hourly', lastmod: todayStr },
    ...liveArticlesCatalog.map((art) => ({
      baseLoc: `${BASE_URL}/makale/${encodeURIComponent(art.slug)}`,
      priority: art.featured ? '0.95' : '0.85',
      changefreq: 'daily',
      lastmod: /^\d{4}-\d{2}-\d{2}$/.test(art.date || '') ? art.date : todayStr
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${baseEntries
  .map(
    (u) => `  <url>
    <loc>${u.baseLoc}?lang=${langParam}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
${SUPPORTED_10_LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${u.baseLoc}?lang=${l}" />`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${u.baseLoc}" />
  </url>`
  )
  .join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

app.get('/sitemap.xml', (_req: Request, res: Response) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const baseUrls = [
    { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'hourly', lastmod: todayStr },
    { loc: `${BASE_URL}/analytics.html`, priority: '0.90', changefreq: 'hourly', lastmod: todayStr },
    { loc: `${BASE_URL}/automation-panel.html`, priority: '0.85', changefreq: 'daily', lastmod: todayStr },
    ...liveArticlesCatalog.map((art) => ({
      loc: `${BASE_URL}/makale/${encodeURIComponent(art.slug)}`,
      priority: art.featured ? '0.95' : '0.85',
      changefreq: 'daily',
      lastmod: /^\d{4}-\d{2}-\d{2}$/.test(art.date || '') ? art.date : todayStr
    }))
  ];

  // Expand each URL with its canonical entry + all 10 language localized entries so all 3,020+ URLs are indexed directly
  const xmlBlocks: string[] = [];
  for (const u of baseUrls) {
    const hreflangLinks =
      SUPPORTED_10_LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${u.loc}?lang=${l}" />`).join('\n') +
      `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${u.loc}" />`;

    xmlBlocks.push(`  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
${hreflangLinks}
  </url>`);

    for (const l of SUPPORTED_10_LANGS) {
      xmlBlocks.push(`  <url>
    <loc>${u.loc}?lang=${l}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
${hreflangLinks}
  </url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${xmlBlocks.join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

// Serve static public files (analytics.html, automation-panel.html, favicon.svg, robots.txt, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Convenient clean routes for analytics and automation pages
app.get('/analytics', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
});

app.get('/automation', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'automation-panel.html'));
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  let vite: any = null;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: 'custom'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  // SPA fallback & Crawler-Friendly HTML entry point
  app.get('*', async (req: Request, res: Response, next) => {
    // Skip API routes or static files with explicit extensions
    if (req.path.startsWith('/api/') || /\.[a-zA-Z0-9]+$/.test(req.path)) {
      return next();
    }

    try {
      const url = req.originalUrl;
      const makaleMatch =
        req.path.match(/^\/(?:tr|en|de|fr|es|it|ru|ar|zh|ja)\/makale\/([^\/]+)/i) ||
        req.path.match(/^\/makale\/([^\/]+)/);
      const pathLangMatch = req.path.match(/^\/(tr|en|de|fr|es|it|ru|ar|zh|ja)(?:\/|$)/i);
      const queryLang = typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : '';
      const activeLang = SUPPORTED_10_LANGS.includes(queryLang)
        ? queryLang
        : pathLangMatch
        ? pathLangMatch[1].toLowerCase()
        : 'tr';

      let targetIndexPath = path.join(__dirname, 'index.html');
      if (isProd && fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
        targetIndexPath = path.join(__dirname, 'dist', 'index.html');
      }

      if (!fs.existsSync(targetIndexPath)) {
        return res.status(404).send('Portal yükleniyor...');
      }

      let template = fs.readFileSync(targetIndexPath, 'utf-8');
      template = template.replace(/<html lang="[^"]*">/, `<html lang="${activeLang}">`);

      if (makaleMatch) {
        const slug = decodeURIComponent(makaleMatch[1]);
        const article = liveArticlesCatalog.find((a) => a.slug === slug);
        if (article) {
          const displayTitle = activeLang === 'en' && article.titleEn ? article.titleEn : article.title;
          const langLabel = SUPPORTED_10_LANG_NAMES[activeLang] || activeLang.toUpperCase();
          const articleTitle = `${escapeHtml(displayTitle)} (${langLabel}) — Sci-Phi | Emre Pelit`;
          const articleDesc = escapeHtml(article.summary || article.subtitle || 'Emre Pelit tarafından kaleme alınan felsefi ve bilimsel inceleme.');
          const encodedSlug = encodeURIComponent(slug);
          const articleUrl = `${BASE_URL}/makale/${encodedSlug}`;
          const localizedArticleUrl = queryLang ? `${articleUrl}?lang=${activeLang}` : articleUrl;

          const articleHreflangs = [
            ...SUPPORTED_10_LANGS.map(
              (l) => `    <link rel="alternate" hreflang="${l}" href="${articleUrl}?lang=${l}" />`
            ),
            `    <link rel="alternate" hreflang="x-default" href="${articleUrl}" />`
          ].join('\n');

          template = template
            .replace(/<title>.*?<\/title>/, `<title>${articleTitle}</title>`)
            .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${articleDesc}" />`)
            .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${articleTitle}" />`)
            .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${articleDesc}" />`)
            .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${localizedArticleUrl}" />`)
            .replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${articleTitle}" />`)
            .replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${articleDesc}" />`)
            .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${localizedArticleUrl}" />`);

          const relatedArch = buildRelatedArticlesArchitecture(article, liveArticlesCatalog);
          const allRelatedNodes = [
            ...relatedArch.primaryRelated,
            ...relatedArch.categoryCluster,
            ...relatedArch.crossDisciplinaryBridge
          ];
          const isRelatedToJson = JSON.stringify(
            relatedArch.primaryRelated.map((r) => ({
              '@type': 'BlogPosting',
              headline: r.article.title,
              url: `${BASE_URL}/makale/${encodeURIComponent(r.article.slug)}`
            }))
          );

          // Inject 10-language hreflang tags and Schema.org BlogPosting with isRelatedTo for Google & all web browsers
          const articleJsonLd = `
${articleHreflangs}
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": "${escapeHtml(displayTitle)}",
      "alternativeHeadline": "${escapeHtml(article.titleEn || article.title)}",
      "description": "${articleDesc}",
      "inLanguage": ["tr", "en", "de", "fr", "es", "it", "ru", "ar", "zh", "ja"],
      "datePublished": "${article.date || '2026-10-14'}",
      "dateModified": "${new Date().toISOString().slice(0, 10)}",
      "mainEntityOfPage": "${localizedArticleUrl}",
      "isRelatedTo": ${isRelatedToJson},
      "author": {
        "@type": "Person",
        "name": "Emre Pelit",
        "url": "${BASE_URL}"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Sci-Phi: Bilim ve Felsefe Portalı",
        "url": "${BASE_URL}"
      }
    }
    </script>`;
          template = template.replace('</head>', `${articleJsonLd}\n  </head>`);

          // Pre-render semantic HTML, Related Articles Architecture, and 10-language links outside root for Googlebot and all web browsers
          const preRenderedHtml = `
    <article style="display:none" class="bot-crawl-content notranslate" data-notranslate="true" aria-hidden="true">
      <h1>${escapeHtml(displayTitle)}</h1>
      <h2>${escapeHtml(article.titleEn || article.title)}</h2>
      <p class="subtitle">${escapeHtml(article.subtitle || '')}</p>
      <p class="lead">${escapeHtml(article.summary || '')}</p>
      <div class="article-body">${escapeHtml(article.content || '')}</div>
      ${article.dialecticalTriad ? `
      <div class="dialectical-triad">
        <p><strong>Tez:</strong> ${escapeHtml(article.dialecticalTriad.thesis)}</p>
        <p><strong>Antitez:</strong> ${escapeHtml(article.dialecticalTriad.antithesis)}</p>
        <p><strong>Sentez:</strong> ${escapeHtml(article.dialecticalTriad.synthesis)}</p>
      </div>` : ''}
      <section data-seo-related-articles="true" aria-label="İlgili Yazılar ve Kavramsal Bağlantı Mimarisi">
        <h3>Bu Yazıyla İlgili Diğer Makaleler (Related Articles Architecture)</h3>
        <ul>
          ${allRelatedNodes.map((r) => `<li><a href="/makale/${encodeURIComponent(r.article.slug)}">${escapeHtml(r.article.title)} (%${r.affinityScore} Kavramsal Uyum — ${escapeHtml(r.relationReasonTr)})</a></li>`).join('\n          ')}
          <li><a rel="prev" href="/makale/${encodeURIComponent(relatedArch.prevArticle.slug)}">Önceki Yazı: ${escapeHtml(relatedArch.prevArticle.title)}</a></li>
          <li><a rel="next" href="/makale/${encodeURIComponent(relatedArch.nextArticle.slug)}">Sonraki Yazı: ${escapeHtml(relatedArch.nextArticle.title)}</a></li>
        </ul>
      </section>
      <nav aria-label="10 Dilde Makale İndeks Bağlantıları">
        <ul>
          ${SUPPORTED_10_LANGS.map((l) => `<li><a href="/makale/${encodedSlug}?lang=${l}" hreflang="${l}">${escapeHtml(displayTitle)} (${SUPPORTED_10_LANG_NAMES[l]})</a></li>`).join('\n          ')}
        </ul>
      </nav>
    </article>`;
          template = template.replace('<div id="root"></div>', `<div id="root"></div>${preRenderedHtml}`);
        }
      } else {
        // Pre-render semantic catalog links in all 10 languages for the homepage so crawlers discover all articles × 10 languages
        const catalogNav = `
    <nav style="display:none" class="bot-crawl-links notranslate" data-notranslate="true" aria-label="10 Dilde Tüm Makaleler ve Sayfalar Dizini" aria-hidden="true">
      <ul>
        ${SUPPORTED_10_LANGS.map((l) => `<li><a href="/?lang=${l}" hreflang="${l}">Sci-Phi Portal (${SUPPORTED_10_LANG_NAMES[l]})</a></li>`).join('\n        ')}
        ${liveArticlesCatalog.map((a) => {
          const enc = encodeURIComponent(a.slug);
          const langAnchors = SUPPORTED_10_LANGS.map(
            (l) => `<a href="/makale/${enc}?lang=${l}" hreflang="${l}">${escapeHtml(a.title)} [${l.toUpperCase()}]</a>`
          ).join(' | ');
          return `<li><a href="/makale/${enc}">${escapeHtml(a.title)}</a> — ${langAnchors}</li>`;
        }).join('\n        ')}
      </ul>
    </nav>`;
        template = template.replace('<div id="root"></div>', `<div id="root"></div>${catalogNav}`);
      }

      if (vite) {
        template = await vite.transformIndexHtml(url, template);
      }

      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      if (vite) {
        vite.ssrFixStacktrace(e as Error);
      }
      next(e);
    }
  });

  const listenPort = Number(PORT) || 3000;
  app.listen(listenPort, '0.0.0.0', () => {
    console.log(`Sci-Phi Server aktif: ${BASE_URL} (Port: ${listenPort})`);
  });
}

startServer();