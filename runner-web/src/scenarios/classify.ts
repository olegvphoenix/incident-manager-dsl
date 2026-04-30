import type { ScenarioEntry } from "./index";

// Категория для группировки в дереве. Подбираем по пути файла + metadata.
export type Category =
  | "showcase"       // showcase/* — стартовая витрина всех UI-примитивов DSL
  | "user"           // user/* — загруженные пользователем через UI
  | "production"     // 01..10 — операторские сценарии VMS
  | "architecture"   // architecture/A1, A4, A7 — демонстрации архитектурных свойств
  | "antipattern";   // architecture/A5/* — анти-паттерны

export interface CategoryDescriptor {
  id: Category;
  title: string;
  hint: string;
}

export const CATEGORIES: CategoryDescriptor[] = [
  {
    id: "showcase",
    title: "Витрина примитивов",
    hint: "Стартовая демонстрация: один сценарий, в котором последовательно показаны все UI-элементы DSL во всех подвариантах. С него удобно начать знакомство",
  },
  {
    id: "user",
    title: "Мои сценарии",
    hint: "Загруженные через интерфейс — хранятся в localStorage браузера, между перезагрузками страницы переживают",
  },
  {
    id: "production",
    title: "Продакшн-сценарии (VMS)",
    hint: "10 операторских сценариев на реальном бизнес-домене: камеры, СКУД, пожарная сигнализация",
  },
  {
    id: "architecture",
    title: "Архитектурные демо",
    hint: "Доказательство архитектурных свойств DSL: minimal, версионирование, читаемость diff'а",
  },
  {
    id: "antipattern",
    title: "Анти-паттерны",
    hint: "Что DSL запрещает (отвергается схемой/сервером) и что плохо стилистически (валидно, но не рекомендуется)",
  },
];

// Подгруппа внутри категории — например, A3-inline-before-after — кладёт 3 файла
// рядом и помечает их единым сабгрупп-заголовком.
export interface ScenarioGroup {
  id: string;
  label: string;
  description?: string;
  entries: ScenarioEntry[];
}

export interface CategorizedTree {
  category: CategoryDescriptor;
  groups: ScenarioGroup[];
}

function detectCategory(entry: ScenarioEntry): Category {
  if (entry.id.startsWith("showcase/")) return "showcase";
  if (entry.id.startsWith("user/")) return "user";
  if (entry.id.startsWith("architecture/A5-anti-patterns/")) return "antipattern";
  if (entry.id.startsWith("architecture/")) return "architecture";
  return "production";
}

// Группа = подпапка (для архитектурных демо она имеет имя вроде "A3-inline-before-after").
// Для production/library каждый файл — своя группа из 1 файла.
function detectGroup(entry: ScenarioEntry, category: Category): { id: string; label: string } {
  if (category === "architecture" || category === "antipattern") {
    const after = entry.id.replace(/^architecture\//, "");
    const m = after.match(/^([A-Z]\d+(?:-[a-z0-9-]+)?)\//);
    if (m) {
      return {
        id: `${category}:${m[1]}`,
        label: groupLabel(m[1]!),
      };
    }
    const top = after.match(/^([A-Z]\d+)-/);
    if (top) {
      return {
        id: `${category}:${top[1]}-single`,
        label: groupLabel(top[1]!),
      };
    }
  }
  return { id: `${category}:_flat`, label: "" };
}

function groupLabel(code: string): string {
  const labels: Record<string, string> = {
    "A1": "A1 — Минимальный сценарий",
    "A4": "A4 — Версионирование",
    "A4-versioning-demo": "A4 — Версионирование",
    "A5": "A5 — Анти-паттерны",
    "A5-anti-patterns": "A5 — Анти-паттерны",
    "A7": "A7 — Читаемость diff'а",
    "A7-diff-readability": "A7 — Читаемость diff'а",
  };
  return labels[code] ?? code;
}

export function buildTree(entries: ScenarioEntry[]): CategorizedTree[] {
  const buckets = new Map<Category, Map<string, ScenarioGroup>>();
  for (const cat of CATEGORIES) buckets.set(cat.id, new Map());

  for (const entry of entries) {
    const cat = detectCategory(entry);
    const group = detectGroup(entry, cat);
    const groupMap = buckets.get(cat)!;
    if (!groupMap.has(group.id)) {
      groupMap.set(group.id, { id: group.id, label: group.label, entries: [] });
    }
    groupMap.get(group.id)!.entries.push(entry);
  }

  return CATEGORIES.map((cat) => ({
    category: cat,
    groups: Array.from(buckets.get(cat.id)!.values())
      .sort((a, b) => a.id.localeCompare(b.id, "ru")),
  })).filter((node) => node.groups.length > 0 || node.category.id === "user");
}
