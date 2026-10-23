import React, { useState, useEffect } from 'react';
import { Clock, Tag, ArrowRight, Layers, FunctionSquare, Calculator, Volume2, Square, Loader2, BookOpen, Eye } from 'lucide-react';
import { Article, ArticleSiteReads } from '../types';
import { ArticleIllustration } from './ArticleIllustration';
import { MathRenderer } from './MathRenderer';
import { getTranslatedArticle, subscribeToTranslationUpdates, t } from '../utils/translations';
import { useSpeechEngine } from '../utils/speechEngine';
import { resolveArticleSubcategory } from '../utils/taxonomy';
import { INITIAL_ARTICLE_SITE_READS } from '../data/baselineStats';

interface ArticleCardProps {
  article: Article;
  indexNumber?: number;
  lang?: string;
  articleMetrics?: ArticleSiteReads;
  onSelect: (slug: string) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  indexNumber,
  lang = 'tr',
  articleMetrics,
  onSelect
}) => {
  const [, setVersion] = useState<number>(0);
  const speech = useSpeechEngine();

  useEffect(() => {
    return subscribeToTranslationUpdates(() => {
      setVersion((v) => v + 1);
    });
  }, []);

  const translated = getTranslatedArticle(article, lang);
  const subcategory = resolveArticleSubcategory(article);
  const subTitle = lang === 'tr' ? subcategory.titleTr : subcategory.titleEn;
  const primaryFormula = translated.mathFormulations?.[0];
  const cardSourceId = `card:${article.slug}`;
  const isSpeakingCard = speech.sourceId === cardSourceId && (speech.isPlaying || speech.isPaused);
  const isLoadingCard = speech.sourceId === cardSourceId && speech.isLoading;

  const resolvedMetrics =
    articleMetrics || INITIAL_ARTICLE_SITE_READS.find((item) => item.slug === article.slug);
  const total8SiteReads = resolvedMetrics?.totalReads || 195;
  const total8SiteViews =
    resolvedMetrics?.totalViews || Math.round(total8SiteReads * 1.35);

  const handleQuickListen = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isSpeakingCard || isLoadingCard) {
      speech.stopSpeech();
      return;
    }

    const textToRead = `${translated.title}. ${translated.subtitle}. ${translated.summary}`;
    speech.speakRawContent(textToRead, lang, speech.rate, cardSourceId, translated.title);
  };

  return (
    <article
      onClick={() => onSelect(article.slug)}
      className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer shadow-lg hover:shadow-amber-500/5 flex flex-col justify-between"
    >
      <div>
        {/* Görsel Küçük Resim */}
        <div className="relative h-44 w-full overflow-hidden border-b border-slate-800">
          <ArticleIllustration
            slug={article.slug}
            category={article.category}
            title={translated.title}
            variant="thumbnail"
            className="w-full h-full"
          />
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            {typeof indexNumber === 'number' && (
              <span className="px-2 py-0.5 rounded-md bg-slate-950/90 text-slate-300 font-mono font-bold border border-slate-700/80 text-[10px]">
                #{String(indexNumber).padStart(2, '0')}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-slate-950/90 text-amber-400 font-semibold border border-amber-500/30 text-[10px] tracking-wide uppercase">
              {translated.categoryTitle}
            </span>
          </div>
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
            <button
              onClick={handleQuickListen}
              title={t('audio_listen', lang)}
              className={`p-1.5 rounded-md border text-[10px] transition ${
                isSpeakingCard || isLoadingCard
                  ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                  : 'bg-slate-950/90 text-amber-400 border-amber-500/30 hover:bg-amber-500 hover:text-slate-950'
              }`}
            >
              {isLoadingCard ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isSpeakingCard ? (
                <Square className="w-3 h-3 fill-current" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
            </button>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-300 text-[10px] font-mono">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{article.readTime}</span>
            </div>
          </div>
        </div>

        {/* Kart İçeriği */}
        <div className="p-5">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-medium mb-1.5 truncate">
            <span>{translated.categoryTitle}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-400 truncate">{subTitle}</span>
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors leading-snug line-clamp-2">
            {translated.title}
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-serif italic line-clamp-1">
            {translated.subtitle}
          </p>
          <p className="text-xs text-slate-300 mt-2.5 line-clamp-2 leading-relaxed font-serif">
            {translated.summary}
          </p>

          {/* LaTeX Formül Önizlemesi */}
          {primaryFormula && (
            <div className="mt-3 p-2 bg-slate-950/90 rounded-lg border border-slate-800/80 group-hover:border-sky-500/30 transition">
              <div className="flex items-center justify-between text-[10px] text-sky-400 font-mono mb-1">
                <span className="flex items-center gap-1">
                  <Calculator className="w-3 h-3" />
                  <span>{primaryFormula.title.slice(0, 32)}</span>
                </span>
                <span className="text-[9px] text-slate-500">{primaryFormula.domain}</span>
              </div>
              <div className="overflow-hidden max-h-10 flex items-center justify-center text-xs">
                <MathRenderer formula={primaryFormula.latex} displayMode={false} className="py-0.5" />
              </div>
            </div>
          )}

          {/* Özellik Rozetleri */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[10px] text-slate-400">
            {translated.mathFormulations && translated.mathFormulations.length > 0 && (
              <span className="flex items-center gap-1 text-sky-400 bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-800/40">
                <FunctionSquare className="w-3 h-3" />
                <span>{translated.mathFormulations.length} Formula</span>
              </span>
            )}
            {translated.dialecticalTriad && (
              <span className="flex items-center gap-1 text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                <Layers className="w-3 h-3" />
                <span>Dialectics</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Makale Altı 8 Web Sitesi Toplam Okunma & Görüntülenme Bloğu + Aksiyon */}
      <div className="px-5 pb-4 pt-3 border-t border-slate-800/80 bg-slate-950/50 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
          <span className="text-[10px] text-slate-400 font-sans">8 Site Toplamı:</span>
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 font-bold"
              title="8 Web Sitesindeki Toplam Net Okunma (Yazar Okumaları Hariç)"
            >
              <BookOpen className="w-3 h-3 text-amber-400" />
              <span>{total8SiteReads.toLocaleString('tr-TR')}</span>
              <span className="text-[9px] font-sans font-normal text-amber-200/80">Okunma</span>
            </span>
            <span
              className="flex items-center gap-1 text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30 font-bold"
              title="8 Web Sitesindeki Kümülatif Toplam Görüntülenme"
            >
              <Eye className="w-3 h-3 text-sky-400" />
              <span>{total8SiteViews.toLocaleString('tr-TR')}</span>
              <span className="text-[9px] font-sans font-normal text-sky-200/80">Görüntülenme</span>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-slate-900">
          <div className="flex items-center gap-1 overflow-hidden text-[10px] text-slate-500">
            <Tag className="w-3 h-3 shrink-0" />
            <span className="truncate">{translated.tags.slice(0, 2).join(', ')}</span>
          </div>
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            <span>{t('read_and_listen', lang)}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
};