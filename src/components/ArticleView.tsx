import React, { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Share2,
  ExternalLink,
  Sparkles,
  HelpCircle,
  Tag,
  CheckCircle,
  FunctionSquare,
  Languages,
  Loader2,
  BookOpen,
  Eye,
  ShieldCheck,
  Mail,
  Linkedin
} from 'lucide-react';
import { Article, ArticleSiteReads } from '../types';
import { MathRenderer } from './MathRenderer';
import { DialecticalTriadView } from './DialecticalTriadView';
import { ObjectionBox } from './ObjectionBox';
import { ArticleIllustration } from './ArticleIllustration';
import { AudioReader } from './AudioReader';
import { InlineRelatedLinksBox, RelatedArticlesSection } from './RelatedArticlesSection';
import { ARTICLES } from '../data/articles';
import { INITIAL_ARTICLE_SITE_READS, ALL_8_WEBSITES_STATS } from '../data/baselineStats';
import {
  SUPPORTED_LANGUAGES,
  getTranslatedArticle,
  translateFullArticle,
  subscribeToTranslationUpdates,
  detectArticleNativeLang,
  t
} from '../utils/translations';
import { isRunningAsInstalledApp } from '../utils/authorShield';

interface ArticleViewProps {
  article: Article;
  allArticles?: Article[];
  lang?: string;
  articleMetrics?: ArticleSiteReads;
  articleStatsMap?: Record<string, ArticleSiteReads>;
  onLanguageChange?: (newLang: string) => void;
  onSelectArticle?: (slug: string) => void;
  onBack: () => void;
  onTrackEvent?: (type: string, details: string, siteId?: string, articleSlug?: string) => void;
  isAuthorShieldActive?: boolean;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  article,
  allArticles = ARTICLES,
  lang = 'tr',
  articleMetrics,
  articleStatsMap,
  onLanguageChange,
  onSelectArticle,
  onBack,
  onTrackEvent
}) => {
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationVersion, setTranslationVersion] = useState<number>(0);
  const scrollTracked = useRef<Record<number, boolean>>({});
  const lastTrackedSlug = useRef<string | null>(null);

  const prevArticleSlugRef = useRef<string | null>(article.slug);

  useEffect(() => {
    return subscribeToTranslationUpdates(() => {
      setTranslationVersion((v) => v + 1);
    });
  }, []);

  // Hedef dil değiştiğinde makalenin tam doğal dil çevirisini getir ve önbelleğe yaz
  useEffect(() => {
    let cancelled = false;
    const native = detectArticleNativeLang(article);
    if (native === lang) {
      setIsTranslating(false);
      return;
    }

    setIsTranslating(true);
    translateFullArticle(article, lang)
      .then(() => {
        if (!cancelled) {
          setTranslationVersion((v) => v + 1);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsTranslating(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // Sadece makale slug'ı veya hedef dil değiştiğinde çalıştır (arka plan veri güncellemelerinde sıfırlama yapma)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.slug, lang]);

  useEffect(() => {
    // Sadece kullanıcı farklı bir makaleye geçtiğinde sayfa başına kaydır;
    // arka plan canlı veri güncellemelerinde mevcut okuma konumunu koru
    if (prevArticleSlugRef.current !== article.slug) {
      prevArticleSlugRef.current = article.slug;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      scrollTracked.current = {};
    }

    const isInstalledApp = isRunningAsInstalledApp();
    const targetSite = isInstalledApp ? 'grok-app' : 'sci-phi-primary';

    // Makale açıldığında hem görüntüleme hem de okunma (article_read / pwa_app_read) sayılır
    if (onTrackEvent && lastTrackedSlug.current !== article.slug) {
      lastTrackedSlug.current = article.slug;
      onTrackEvent(
        isInstalledApp ? 'pwa_app_read' : 'article_read',
        `${article.title}${isInstalledApp ? ' (Uygulama / PWA)' : ''}`,
        targetSite,
        article.slug
      );
    }

    const timer = setTimeout(() => {
      if (onTrackEvent) {
        onTrackEvent('article_engaged_10s', `${article.title} (10s active read)`, targetSite, article.slug);
      }
    }, 10000);

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      if (height <= 0) return;
      const percent = Math.round((scrollY / height) * 100);

      [25, 50, 75, 90].forEach((milestone) => {
        if (percent >= milestone && !scrollTracked.current[milestone]) {
          scrollTracked.current[milestone] = true;
          if (onTrackEvent) {
            onTrackEvent('scroll_depth', `${article.title} - %${milestone} okundu`, targetSite, article.slug);
          }
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
    // Sadece makale slug'ı değiştiğinde çalıştır; onTrackEvent veya arka plan makale nesnesi güncellendiğinde tetikleme
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.slug]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      if (onTrackEvent) {
        onTrackEvent('social_share', article.title, 'sci-phi-primary', article.slug);
      }
    }
  };

  const handleFormulaClick = (formulaTitle: string) => {
    if (onTrackEvent) {
      onTrackEvent('formula_interaction', `${article.title}: ${formulaTitle}`, 'sci-phi-primary', article.slug);
    }
  };

  const handleGlobalLangSwitch = (newLang: string) => {
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
    if (onTrackEvent) {
      onTrackEvent('language_change', `Site & Article switched to ${newLang.toUpperCase()}`);
    }
  };

  // Seçili hedef dile göre çevrilmiş makale
  const translated = getTranslatedArticle(article, lang);
  void translationVersion;

  const resolvedMetrics =
    articleMetrics || INITIAL_ARTICLE_SITE_READS.find((item) => item.slug === article.slug);
  const total8SitesReads = resolvedMetrics ? resolvedMetrics.totalReads : 0;
  const total8SitesViews = resolvedMetrics
    ? resolvedMetrics.totalViews || Math.round(resolvedMetrics.totalReads * 1.35)
    : 0;

  const renderInlineFormatting = (text: string): React.ReactNode[] => {
    // Parse inline math ($...$), bold (**...**), and italic (*...*)
    const tokenRegex = /(\$[^$\n]+\$|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
    const parts = text.split(tokenRegex);
    return parts.map((part, i) => {
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const latex = part.slice(1, -1);
        return <MathRenderer key={i} formula={latex} displayMode={false} />;
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={i} className="font-bold text-slate-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <em key={i} className="italic text-amber-200/90">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  const renderMarkdown = (text: string) => {
    const lines = (text || '').split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-xl font-bold text-white mt-8 mb-4 border-l-4 border-amber-500 pl-3">
            {renderInlineFormatting(line.replace('### ', ''))}
          </h3>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-2xl font-black text-amber-300 mt-10 mb-4">
            {renderInlineFormatting(line.replace('## ', ''))}
          </h2>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <li key={idx} className="text-slate-300 ml-4 list-disc text-sm my-1 leading-relaxed font-serif">
            {renderInlineFormatting(line.replace('- ', ''))}
          </li>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-3" />;
      }
      return (
        <p key={idx} className="text-slate-300 text-sm md:text-base leading-relaxed my-3 font-serif">
          {renderInlineFormatting(line)}
        </p>
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      {/* Üst Navigasyon Barı */}
      <div className="flex flex-wrap items-center justify-between mb-6 pb-4 border-b border-slate-800 gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back_to_essays', lang)}</span>
        </button>

        <div className="flex items-center gap-2.5">
          {isTranslating && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Çevriliyor...</span>
            </span>
          )}

          {/* Küresel Dil Seçici (Tüm siteyi ve sesli okumayı aynı anda değiştirir) */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-amber-500/40 rounded-xl px-2.5 py-1 text-xs">
            <Languages className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={lang}
              onChange={(e) => handleGlobalLangSwitch(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-slate-950 text-slate-200">
                  {l.flag} {l.nativeName}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleShare}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-700 transition flex items-center gap-1.5"
          >
            {copiedLink ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? t('copied', lang) : t('share', lang)}</span>
          </button>
        </div>
      </div>

      {/* Görsel İllüstrasyon */}
      <div className="mb-8">
        <ArticleIllustration
          slug={article.slug}
          category={article.category}
          title={translated.title}
          variant="banner"
          className="h-64 sm:h-80 md:h-96 w-full"
        />
      </div>

      {/* Makale Başlığı */}
      <header className="space-y-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold uppercase tracking-wider">
            {translated.categoryTitle}
          </span>
          <span className="text-xs text-slate-500 font-mono">ID: {article.slug}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
          {translated.title}
        </h1>

        <p className="text-base sm:text-lg text-slate-400 font-serif italic leading-relaxed">
          {translated.subtitle}
        </p>

        {/* Meta Bilgiler */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-white font-medium">{article.author}</span>
          </div>
          <a
            href="mailto:emrepelit39@gmail.com"
            className="flex items-center gap-1 text-amber-300 hover:text-amber-400 font-mono transition"
            title="Yazar E-posta: emrepelit39@gmail.com"
          >
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>emrepelit39@gmail.com</span>
          </a>
          <a
            href="https://www.linkedin.com/in/emrepelit109"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sky-300 hover:text-sky-400 font-mono transition"
            title="Emre Pelit LinkedIn: www.linkedin.com/in/emrepelit109"
          >
            <Linkedin className="w-3.5 h-3.5 text-sky-400" />
            <span>www.linkedin.com/in/emrepelit109</span>
          </a>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{article.date}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{article.readTime}</span>
          </div>
          {resolvedMetrics && (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <strong>{total8SitesReads.toLocaleString('tr-TR')}</strong>
                <span className="font-sans text-[11px]">8 Sitedeki Toplam Okunma (Yazar Hariç)</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono">
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <strong>{total8SitesViews.toLocaleString('tr-TR')}</strong>
                <span className="font-sans text-[11px]">8 Sitedeki Toplam Görüntülenme</span>
              </div>
            </>
          )}
          {article.bloggerUrl && (
            <a
              href={article.bloggerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-amber-400 hover:underline ml-auto"
            >
              <span>Blogger Canonical</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </header>

      {/* Çok Dilli Sesli Okuma Bileşeni (Seçilen dilde çevrilmiş makaleyi okur) */}
      <AudioReader
        article={translated}
        currentLang={lang}
        onLanguageChange={handleGlobalLangSwitch}
        onTrackEvent={onTrackEvent}
      />

      {/* Yönetici Özeti */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border-l-4 border-amber-500 border-y border-r border-slate-800 mb-8 shadow-md">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t('executive_summary', lang)}</span>
        </h4>
        <p className="text-sm text-slate-200 font-serif leading-relaxed">
          {translated.summary}
        </p>
      </div>

      {/* Ana İçerik */}
      <div className="prose prose-invert max-w-none mb-6">
        {renderMarkdown(translated.content)}
      </div>

      {/* Makale Altı: 8 Web Sitesindeki Toplam Okunma ve Görüntülenme Sayısı (Yazar Hesabı Okumaları Hariç) */}
      {resolvedMetrics && (
        <div className="my-8 p-5 sm:p-6 rounded-2xl bg-slate-900/95 border border-emerald-500/30 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  {lang === 'tr'
                    ? 'BU MAKALENİN 8 WEB SİTESİNDEKİ TOPLAM OKUNMA VE GÖRÜNTÜLENME İSTATİSTİKLERİ'
                    : 'TOTAL READS & VIEWS ACROSS ALL 8 WEBSITES FOR THIS ESSAY'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] font-semibold text-amber-300">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  {lang === 'tr' ? 'Yazar Hesabı Okumaları Hariç' : 'Author Account Reads Excluded'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'tr'
                  ? '8 web sitesinin tamamında açılış zamanından itibaren ölçülen ve canlı yeni verilerle senkronize edilen makale trafiği toplamı:'
                  : 'Combined essay traffic measured since launch across all 8 websites and synchronized with live data:'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-right">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  {lang === 'tr' ? '8 Sitedeki Toplam Net Okunma' : '8-Site Total Net Reads'}
                </span>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span className="text-lg sm:text-xl font-black font-mono text-emerald-400">
                    {total8SitesReads.toLocaleString('tr-TR')}
                  </span>
                </div>
              </div>

              <div className="px-4 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-right">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  {lang === 'tr' ? '8 Sitedeki Toplam Görüntülenme' : '8-Site Total Views'}
                </span>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <Eye className="w-4 h-4 text-sky-400" />
                  <span className="text-lg sm:text-xl font-black font-mono text-sky-400">
                    {total8SitesViews.toLocaleString('tr-TR')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 8 Web Sitesi Bazında Ayrıntılı Dağılım */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {ALL_8_WEBSITES_STATS.map((site) => {
              const count = resolvedMetrics.bySite[site.id] || 0;
              const viewsCount = resolvedMetrics.viewsBySite?.[site.id] ?? Math.round(Number(count) * 1.35);
              return (
                <div
                  key={site.id}
                  className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 flex flex-col justify-between"
                >
                  <span className="text-[11px] text-slate-400 font-mono truncate" title={site.domain}>
                    {site.domain}
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      {Number(count).toLocaleString('tr-TR')}{' '}
                      <span className="text-[9px] font-sans font-normal text-slate-500">okunma</span>
                    </span>
                    <span className="text-[10px] font-mono text-sky-400">
                      {Number(viewsCount).toLocaleString('tr-TR')}{' '}
                      <span className="text-[9px] font-sans font-normal text-slate-500">gör.</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Makale Metni Altı Hızlı İlgili Yazı Bağlantıları */}
      <InlineRelatedLinksBox
        currentArticle={article}
        allArticles={allArticles}
        lang={lang}
        articleStatsMap={articleStatsMap}
        onSelectArticle={(slug) => {
          if (onSelectArticle) {
            onSelectArticle(slug);
          } else {
            window.location.href = `/makale/${slug}`;
          }
        }}
      />

      {/* Matematiksel Formülasyonlar */}
      {translated.mathFormulations && translated.mathFormulations.length > 0 && (
        <section className="my-10 p-6 bg-slate-900/80 rounded-2xl border border-sky-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <FunctionSquare className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-sky-300 uppercase tracking-wider">
              {t('math_formulations_title', lang)}
            </h3>
          </div>
          <div className="space-y-6">
            {translated.mathFormulations.map((formula, idx) => (
              <div
                key={idx}
                onClick={() => handleFormulaClick(formula.title)}
                className="p-4 bg-slate-950 rounded-xl border border-slate-800 hover:border-sky-500/40 transition cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span className="text-sky-400">{formula.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                    {formula.domain}
                  </span>
                </div>
                <div className="my-3 text-center bg-slate-900/60 p-4 rounded-lg">
                  <MathRenderer formula={formula.latex} displayMode={true} />
                </div>
                <p className="text-xs text-slate-400 font-serif leading-relaxed mt-2 pt-2 border-t border-slate-800/80">
                  <strong className="text-slate-300 font-sans">{t('philosophical_meaning', lang)}</strong> {formula.interpretation}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Diyalektik Üçleme */}
      {translated.dialecticalTriad && (
        <DialecticalTriadView triad={translated.dialecticalTriad} lang={lang} />
      )}

      {/* Felsefi İtirazlar */}
      {translated.objections && translated.objections.length > 0 && (
        <ObjectionBox objections={translated.objections} lang={lang} />
      )}

      {/* Sokratik Sorgulama Soruları */}
      {translated.socraticQuestions && translated.socraticQuestions.length > 0 && (
        <section className="my-8 p-6 bg-slate-900/70 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('socratic_questions_title', lang)}
            </h4>
          </div>
          <ul className="space-y-2">
            {translated.socraticQuestions.map((q, idx) => (
              <li key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-300 font-serif flex items-start gap-2">
                <span className="text-amber-400 font-sans font-bold">Q{idx + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Alt Etiketler & Dönüş */}
      <footer className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-slate-500 mr-1" />
          {translated.tags.map((tag, idx) => (
            <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300">
              #{tag}
            </span>
          ))}
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition"
        >
          {t('back_to_essays', lang)}
        </button>
      </footer>

      {/* Kapsamlı İlgili Yazılar (Related Articles) Mimarisi */}
      <RelatedArticlesSection
        currentArticle={article}
        allArticles={allArticles}
        lang={lang}
        articleStatsMap={articleStatsMap}
        onSelectArticle={(slug) => {
          if (onSelectArticle) {
            onSelectArticle(slug);
          } else {
            window.location.href = `/makale/${slug}`;
          }
        }}
      />
    </div>
  );
};