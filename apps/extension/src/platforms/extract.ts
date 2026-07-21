const AI_LABEL_PATTERNS = [
  /conteúdo alterado ou sintético/iu,
  /conteúdo gerado por ia/iu,
  /informações? de conteúdo de ia/iu,
  /altered or synthetic content/iu,
  /made with ai/iu,
  /criado com ia/iu,
  /feito com ia/iu,
  /produzido com ia/iu,
  /ai-generated/iu,
  /^ai info$/iu,
  /^informações de ia$/iu,
];

const HASHTAG_RE = /#\p{L}[\p{L}\p{N}_]*/gu;

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function isVisible(element: Element): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]')) return false;
  const html = element as HTMLElement;
  if (html.style.display === "none" || html.style.visibility === "hidden" || html.style.opacity === "0") {
    return false;
  }
  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(html);
  return !style || (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0");
}

export function firstVisibleText(root: ParentNode, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    for (const element of root.querySelectorAll(selector)) {
      if (!isVisible(element)) continue;
      const text = normalizeText(element.textContent);
      if (text) return text;
    }
  }
  return undefined;
}

export function uniqueTexts(values: Array<string | undefined>): string[] {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

export function extractHashtags(text: string): string[] {
  return [...new Set((normalizeText(text).match(HASHTAG_RE) ?? []).map((tag) => tag.toLowerCase()))];
}

export function extractPlatformLabels(root: ParentNode, selectors: string[]): string[] {
  const labels: string[] = [];
  for (const selector of selectors) {
    for (const element of root.querySelectorAll(selector)) {
      if (!isVisible(element)) continue;
      const values = [element.textContent, element.getAttribute("aria-label"), element.getAttribute("title")];
      for (const text of uniqueTexts(values.map((value) => value ?? undefined))) {
        if (AI_LABEL_PATTERNS.some((pattern) => pattern.test(text))) labels.push(text);
      }
    }
  }
  return uniqueTexts(labels);
}

export function belongsToRoot(element: Element, root: Element, rootSelector: string): boolean {
  return element.closest(rootSelector) === root;
}
