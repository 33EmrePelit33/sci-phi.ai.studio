import { useEffect, useState } from 'react';
import { translateBatchTexts } from './translations';

interface TrackedTextNode extends Text {
  __sciphiOrigText?: string;
  __sciphiAppliedLang?: string;
  __sciphiAppliedText?: string;
}

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'SVG',
  'MATH'
]);

function shouldTranslateText(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return false;
  // Skip pure numbers, symbols, dates, formulas, or domain names
  if (/^[\d\s.,:%+\-*/=()[\]#@!?;•→←↑↓✓★Φγλ∞]+$/.test(trimmed)) return false;
  if (/^(https?:\/\/|sci-phi\.|emrepelit|www\.|[a-z0-9-]+\.(com|org|net|me|io|studio|app|dev))/i.test(trimmed)) {
    return false;
  }
  if (/^ID:\s/i.test(trimmed)) return false;
  return true;
}

export async function translateDOMSubtree(
  root: HTMLElement | null,
  targetLang: string,
  onStatusChange?: (translating: boolean) => void
): Promise<void> {
  if (!root || typeof document === 'undefined') return;

  // 1. Walk and translate text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('.katex, .notranslate, [data-notranslate="true"], select, code, pre')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodesToProcess: TrackedTextNode[] = [];
  let current = walker.nextNode() as TrackedTextNode | null;
  while (current) {
    const val = current.nodeValue || '';
    if (shouldTranslateText(val)) {
      if (
        current.__sciphiOrigText === undefined ||
        (current.__sciphiAppliedText !== undefined && val !== current.__sciphiAppliedText)
      ) {
        current.__sciphiOrigText = val;
        current.__sciphiAppliedLang = undefined;
      }
      nodesToProcess.push(current);
    }
    current = walker.nextNode() as TrackedTextNode | null;
  }

  // 2. Also translate input and textarea placeholders
  const placeholderElements = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[placeholder], textarea[placeholder]'
  );
  const placeholderItems: { el: HTMLInputElement | HTMLTextAreaElement; orig: string }[] = [];

  placeholderElements.forEach((el) => {
    if (el.closest('.notranslate, [data-notranslate="true"]')) return;
    const ph = (el as any).__sciphiOrigPlaceholder || el.placeholder;
    if (ph && shouldTranslateText(ph)) {
      if (!(el as any).__sciphiOrigPlaceholder) {
        (el as any).__sciphiOrigPlaceholder = ph;
      }
      placeholderItems.push({ el, orig: (el as any).__sciphiOrigPlaceholder });
    }
  });

  if (targetLang === 'tr') {
    // Only restore original Turkish texts for nodes that were translated into another language
    nodesToProcess.forEach((n) => {
      if (
        n.__sciphiAppliedLang &&
        n.__sciphiAppliedLang !== 'tr' &&
        n.__sciphiOrigText !== undefined &&
        n.nodeValue !== n.__sciphiOrigText
      ) {
        n.nodeValue = n.__sciphiOrigText;
        n.__sciphiAppliedText = n.__sciphiOrigText;
        n.__sciphiAppliedLang = 'tr';
      }
    });
    placeholderItems.forEach(({ el, orig }) => {
      if (el.placeholder !== orig) {
        el.placeholder = orig;
      }
    });
    return;
  }

  const pendingNodes = nodesToProcess.filter((n) => n.__sciphiAppliedLang !== targetLang);
  if (pendingNodes.length === 0 && placeholderItems.length === 0) return;

  if (onStatusChange) onStatusChange(true);

  try {
    const sourceTexts = pendingNodes.map((n) => (n.__sciphiOrigText || n.nodeValue || '').trim());
    const phTexts = placeholderItems.map((p) => p.orig.trim());

    const allSources = [...sourceTexts, ...phTexts];
    if (allSources.length === 0) return;

    const translatedList = await translateBatchTexts(allSources, targetLang);

    // Apply to text nodes
    pendingNodes.forEach((n, idx) => {
      const orig = n.__sciphiOrigText || n.nodeValue || '';
      const translated = translatedList[idx];
      if (translated && n.isConnected) {
        const leadingMatch = orig.match(/^\s*/);
        const trailingMatch = orig.match(/\s*$/);
        const leading = leadingMatch ? leadingMatch[0] : '';
        const trailing = trailingMatch ? trailingMatch[0] : '';
        const finalStr = `${leading}${translated}${trailing}`;
        if (n.nodeValue !== finalStr) {
          n.nodeValue = finalStr;
        }
        n.__sciphiAppliedText = finalStr;
        n.__sciphiAppliedLang = targetLang;
      } else if (n.isConnected) {
        n.__sciphiAppliedLang = targetLang;
      }
    });

    // Apply to placeholders
    const offset = sourceTexts.length;
    placeholderItems.forEach(({ el }, pIdx) => {
      const trPh = translatedList[offset + pIdx];
      if (trPh && el.isConnected && el.placeholder !== trPh) {
        el.placeholder = trPh;
      }
    });
  } finally {
    if (onStatusChange) onStatusChange(false);
  }
}

export async function triggerInstantSiteTranslation(targetLang: string): Promise<void> {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('root');
  if (root) {
    await translateDOMSubtree(root, targetLang);
  }
}

export function useWholeSiteTranslation(lang: string, triggerKey?: string | number) {
  const [isSiteTranslating, setIsSiteTranslating] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('sciphi_lang', lang);
    } catch {
      // ignore
    }

    const root = document.getElementById('root');
    if (!root) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let isRunning = false;
    let isCancelled = false;

    const updateStatusSafe = (translating: boolean) => {
      if (isCancelled) return;
      setIsSiteTranslating((prev) => (prev === translating ? prev : translating));
    };

    const runTranslation = () => {
      if (isRunning || isCancelled) return;
      isRunning = true;
      translateDOMSubtree(root, lang, updateStatusSafe).finally(() => {
        isRunning = false;
      });
    };

    // Initial pass immediately
    const initTimer = setTimeout(runTranslation, 40);

    // Dynamic DOM mutation listener for new elements, modals, tabs, simulators
    const observer = new MutationObserver((mutations) => {
      if (lang === 'tr' || isRunning || isCancelled) return;
      const hasRelevantAddition = mutations.some((m) => {
        if (m.type !== 'childList' || m.addedNodes.length === 0) return false;
        const targetEl = m.target instanceof HTMLElement ? m.target : m.target.parentElement;
        if (targetEl && targetEl.closest('.notranslate, [data-notranslate="true"]')) {
          return false;
        }
        return true;
      });
      if (!hasRelevantAddition) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runTranslation, 120);
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });

    // Custom force trigger listener
    const handleForceTrigger = (e: Event) => {
      if (isCancelled) return;
      const customEvent = e as CustomEvent<{ lang?: string; force?: boolean }>;
      const target = customEvent.detail?.lang || lang;
      if (customEvent.detail?.force) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode() as TrackedTextNode | null;
        while (node) {
          if (node.__sciphiAppliedLang && node.__sciphiAppliedLang !== target) {
            node.__sciphiAppliedLang = undefined;
          }
          node = walker.nextNode() as TrackedTextNode | null;
        }
      }
      translateDOMSubtree(root, target, updateStatusSafe);
    };

    window.addEventListener('sciphi:trigger-site-translation', handleForceTrigger);

    return () => {
      isCancelled = true;
      clearTimeout(initTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
      window.removeEventListener('sciphi:trigger-site-translation', handleForceTrigger);
    };
  }, [lang, triggerKey]);

  return {
    isSiteTranslating,
    retranslateNow: () => {
      const root = document.getElementById('root');
      return translateDOMSubtree(root, lang, (val) =>
        setIsSiteTranslating((prev) => (prev === val ? prev : val))
      );
    }
  };
}
