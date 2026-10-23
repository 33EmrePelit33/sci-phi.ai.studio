import type { Article } from '../types/index.ts';
import bloggerCatalog from './bloggerCatalog.json' with { type: 'json' };

export const FOUNDATIONAL_ARTICLES: Article[] = [];

function hydrateBloggerArticle(raw: any, idx: number): Article {
  const title = String(raw.title || 'Felsefi & Bilimsel İnceleme').replace(/\s+/g, ' ').trim();
  const tags = Array.isArray(raw.tags) && raw.tags.length > 0 ? raw.tags : ['Bilim', 'Felsefe', 'Kozmoloji'];
  const summary = raw.summary || '';
  const content = raw.content || '';
  return {
    id: raw.id || `blogger-post-${idx + 1}`,
    slug: raw.slug,
    title,
    titleEn: raw.titleEn ? String(raw.titleEn).replace(/\s+/g, ' ').trim() : title,
    subtitle: raw.subtitle || `${tags.slice(0, 3).join(' • ')} Üzerine Analitik Çözümleme`,
    subtitleEn: raw.subtitleEn || `Analytical Exploration on ${tags.slice(0, 2).join(' & ')}`,
    category: raw.category || 'epistemoloji',
    categoryTitle: raw.categoryTitle || 'Epistemoloji & Felsefe',
    categoryTitleEn: raw.categoryTitleEn || 'Epistemology & Philosophy',
    summary,
    summaryEn: raw.summaryEn || summary,
    content,
    contentEn: raw.contentEn || content,
    author: raw.author || 'Emre Pelit',
    date: raw.date || '2026-10-21',
    readTime: raw.readTime || '6 dk',
    featured: Boolean(raw.featured),
    tags,
    mathFormulations: raw.mathFormulations || [],
    dialecticalTriad: raw.dialecticalTriad || {
      thesis: `Tez: ${title} bağlamında kabul edilen geleneksel sezgi ve yerleşik kabuller.`,
      antithesis: 'Antitez: Fiziksel gözlemlerin ve mantıksal paradoksların ortaya çıkardığı kaçınılmaz ontolojik çelişki.',
      synthesis: 'Sentez (Aufhebung): Her iki karşıtlığı daha kapsamlı bir teorik çatıda uzlaştıran üst düzey hakikat.'
    },
    objections: raw.objections || [
      {
        id: `obj-${idx}-1`,
        philosopher: 'Klasik Eleştirmen',
        school: 'Analitik Felsefe',
        objection: 'Bu önerme, ampirik doğrulamanın sınırlarını aşarak spekülatif bir metafiziğe kayma riski taşımaz mı?',
        rebuttal: 'Tüm kuramsal modeller matematiksel tutarlılık ve modern fizik bulgularıyla temellendirilmektedir.'
      }
    ],
    socraticQuestions: raw.socraticQuestions || [
      'Bu incelemede ulaşılan sonucun zıddını varsaysaydık, evren anlayışımızda hangi temel aksiyom çökerdi?',
      'İnsan zihninin bu olguyu kavrayış biçimi, olgunun nesnel gerçekliğini ne ölçüde sınırlar?'
    ],
    bloggerUrl: raw.bloggerUrl || 'https://emrepelit7337.blogspot.com/'
  };
}

export function mergeBloggerWithFoundational(bloggerPosts: any[]): Article[] {
  const existingSlugs = new Set<string>();
  const uniqueBloggerArticles: Article[] = [];

  (bloggerPosts || []).forEach((raw, idx) => {
    if (raw && raw.slug && !existingSlugs.has(raw.slug)) {
      existingSlugs.add(raw.slug);
      uniqueBloggerArticles.push(hydrateBloggerArticle(raw, idx));
    }
  });

  // Sort by date descending; for posts on the same date, prioritize Turkish titles first so the primary Turkish essay leads
  uniqueBloggerArticles.sort((a, b) => {
    if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
    const aIsTr = /[çğışİĞŞ]|\b(ve|mi|mı|mu|mü|için|olarak|nedir|nasıl)\b/i.test(a.title) ? 1 : 0;
    const bIsTr = /[çğışİĞŞ]|\b(ve|mi|mı|mu|mü|için|olarak|nedir|nasıl)\b/i.test(b.title) ? 1 : 0;
    return bIsTr - aIsTr;
  });

  // Ensure the leading posts are marked featured
  uniqueBloggerArticles.forEach((art, i) => {
    art.featured = i < 6;
  });

  return uniqueBloggerArticles;
}

export const ARTICLES: Article[] = mergeBloggerWithFoundational(bloggerCatalog as any[]);

export const CATEGORIES = [
  { id: 'all', title: 'Tümü', titleEn: 'All' },
  { id: 'fizik-kozmoloji', title: 'Fizik & Kozmoloji', titleEn: 'Physics & Cosmology' },
  { id: 'zihin-bilinc', title: 'Zihin & Bilinç', titleEn: 'Mind & Consciousness' },
  { id: 'epistemoloji', title: 'Epistemoloji & Felsefe', titleEn: 'Epistemology & Philosophy' },
  { id: 'diyalektik-mantik', title: 'Diyalektik & Mantık', titleEn: 'Dialectics & Logic' },
  { id: 'etik-teknoloji', title: 'Etik & Teknoloji', titleEn: 'Ethics & Technology' }
];
