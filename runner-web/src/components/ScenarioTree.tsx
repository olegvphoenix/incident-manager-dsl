import { useMemo, useState } from "react";
import type { ScenarioEntry } from "../scenarios";
import { buildTree, type Category } from "../scenarios/classify";

interface Props {
  scenarios: ScenarioEntry[];
  selectedId: string | null;
  runningId: string | null;
  onSelect: (entry: ScenarioEntry) => void;
  onAddScenario?: () => void;
  onExportAll?: () => void;
  onImport?: () => void;
}

const DEFAULT_OPEN: Record<Category, boolean> = {
  showcase: true,
  user: true,
  production: true,
  library: false,
  architecture: false,
  antipattern: false,
};

export function ScenarioTree({ scenarios, selectedId, runningId, onSelect, onAddScenario, onExportAll, onImport }: Props) {
  const tree = useMemo(() => buildTree(scenarios), [scenarios]);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(DEFAULT_OPEN);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function toggleCat(id: Category) {
    setOpenCats((p) => ({ ...p, [id]: !p[id] }));
  }
  function toggleGroup(id: string) {
    setOpenGroups((p) => ({ ...p, [id]: !p[id] }));
  }

  return (
    <nav className="tree">
      <div className="tree__title-row">
        <h3 className="tree__title">Сценарии</h3>
        <div className="tree__actions">
          {onAddScenario && (
            <button className="btn-mini btn-mini--primary" onClick={onAddScenario} title="Добавить сценарий из файла">
              + Добавить
            </button>
          )}
          {onImport && (
            <button className="btn-mini" onClick={onImport} title="Импорт из ZIP или нескольких .json (пакетно)">
              ⬆ Импорт
            </button>
          )}
          {onExportAll && (
            <button className="btn-mini" onClick={onExportAll} title="Скачать все сценарии (примеры + Мои) одним ZIP">
              ⬇ Экспорт ZIP
            </button>
          )}
        </div>
      </div>
      {tree.map(({ category, groups }) => {
        const total = groups.reduce((acc, g) => acc + g.entries.length, 0);
        const isOpen = openCats[category.id] ?? false;
        return (
          <div key={category.id} className="tree__cat">
            <button
              className="tree__cat-header"
              onClick={() => toggleCat(category.id)}
              title={category.hint}
            >
              <span className="tree__chevron">{isOpen ? "▾" : "▸"}</span>
              <span className="tree__cat-title">{category.title}</span>
              <span className="tree__cat-count">{total}</span>
            </button>
            {isOpen && (
              <div className="tree__cat-body">
                <p className="tree__cat-hint">{category.hint}</p>
                {category.id === "user" && groups.length === 0 && (
                  <p className="tree__empty">
                    Пока пусто. Нажмите <strong>+ Добавить</strong>, чтобы загрузить .json-файл сценария.
                  </p>
                )}
                {groups.map((g) => {
                  const flat = g.entries.length === 1 || !g.label;
                  if (flat) {
                    return g.entries.map((e) => (
                      <ItemRow
                        key={e.id}
                        entry={e}
                        depth={1}
                        active={e.id === selectedId}
                        running={e.id === runningId}
                        onSelect={onSelect}
                      />
                    ));
                  }
                  const groupOpen = openGroups[g.id] ?? true;
                  return (
                    <div key={g.id} className="tree__group">
                      <button
                        className="tree__group-header"
                        onClick={() => toggleGroup(g.id)}
                      >
                        <span className="tree__chevron">{groupOpen ? "▾" : "▸"}</span>
                        <span>{g.label}</span>
                        <span className="tree__cat-count">{g.entries.length}</span>
                      </button>
                      {groupOpen && g.entries.map((e) => (
                        <ItemRow
                          key={e.id}
                          entry={e}
                          depth={2}
                          active={e.id === selectedId}
                          running={e.id === runningId}
                          onSelect={onSelect}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function ItemRow({
  entry,
  depth,
  active,
  running,
  onSelect,
}: {
  entry: ScenarioEntry;
  depth: number;
  active: boolean;
  running: boolean;
  onSelect: (e: ScenarioEntry) => void;
}) {
  const name = entry.scenario.metadata?.name ?? entry.id;
  const fileName = entry.id.split("/").pop() ?? entry.id;
  return (
    <button
      className={`tree__item depth-${depth} ${active ? "tree__item--active" : ""} ${running ? "tree__item--running" : ""} ${!entry.isRunnable ? "tree__item--blocked" : ""}`}
      onClick={() => onSelect(entry)}
      title={entry.reasonNotRunnable ?? entry.id}
    >
      <span className="tree__item-icon">
        {running ? "▶" : entry.isRunnable ? "·" : "⊘"}
      </span>
      <span className="tree__item-name">{name}</span>
      <span className="tree__item-file">{fileName}</span>
    </button>
  );
}
