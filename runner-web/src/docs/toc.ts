// Извлекаем структуру оглавления из markdown.
// Логика идентификаторов должна совпадать с rehype-slug, иначе ссылки не сработают.
// rehype-slug использует github-slugger: lowercase, replace non-alphanumeric with '-',
// dedupe with -1, -2.

import GithubSlugger from "github-slugger";

export interface TocItem {
  id: string;       // slug, как у rehype-slug
  text: string;
  depth: number;    // 2..4
}

export function extractToc(source: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  // ⚠️ Игнорируем заголовки внутри fenced code-blocks (``` ... ```).
  const lines = source.split(/\r?\n/);
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;
    const depth = m[1]!.length;
    if (depth < 2 || depth > 4) continue;
    const text = stripMarkdown(m[2]!);
    if (!text) continue;
    items.push({ id: slugger.slug(text), text, depth });
  }
  return items;
}

// Грубо удаляем inline markdown (`code`, **bold**, [link](url), <html>).
function stripMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")    // ![alt](url) → alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")     // [text](url) → text
    .replace(/`([^`]+)`/g, "$1")                  // `code`
    .replace(/\*\*([^*]+)\*\*/g, "$1")            // **bold**
    .replace(/\*([^*]+)\*/g, "$1")                // *italic*
    .replace(/<[^>]+>/g, "")                      // <html>
    .trim();
}
