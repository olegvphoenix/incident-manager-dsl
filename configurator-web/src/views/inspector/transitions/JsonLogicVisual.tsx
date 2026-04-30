import { memo, useMemo } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CodeIcon from "@mui/icons-material/Code";

import {
  COMPARISON_OPS,
  defaultCompare,
  defaultLeaf,
  type ComparisonOp,
  type LogicNode,
} from "./jsonLogicModel";
import { useEditorStore } from "../../../store/editorStore";

interface Props {
  node: LogicNode;
  onChange: (next: LogicNode) => void;
  // если этот узел внутри and/or/not — родитель может его удалить
  onDelete?: () => void;
  depth?: number;
}

// Рекурсивный визуальный редактор JSONLogic. Узел выбирает свой контрол
// через `node.kind`. Изменения немедленно «всплывают» в onChange — родитель
// собирает дерево обратно и сериализует в JSONLogic.
export const JsonLogicVisual = ({ node, onChange, onDelete, depth = 0 }: Props) => {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: depth === 0 ? "primary.light" : "divider",
        borderRadius: 1,
        p: 0.75,
        bgcolor: depth % 2 === 0 ? "background.paper" : "action.hover",
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
          <NodeBody node={node} onChange={onChange} depth={depth} />
        </Box>
        <KindSwitcher node={node} onChange={onChange} />
        {onDelete && (
          <Tooltip title="Удалить этот узел">
            <IconButton size="small" onClick={onDelete}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
};

// === тело узла по kind ===

const NodeBody = ({
  node,
  onChange,
  depth,
}: {
  node: LogicNode;
  onChange: (n: LogicNode) => void;
  depth: number;
}) => {
  switch (node.kind) {
    case "boolean":
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label="bool" variant="outlined" />
          <Select
            size="small"
            value={node.value ? "true" : "false"}
            onChange={(e) =>
              onChange({ kind: "boolean", value: e.target.value === "true" })
            }
            sx={{ minWidth: 90 }}
          >
            <MenuItem value="true">true</MenuItem>
            <MenuItem value="false">false</MenuItem>
          </Select>
        </Stack>
      );

    case "number":
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label="num" variant="outlined" />
          <TextField
            size="small"
            type="number"
            value={node.value}
            onChange={(e) => onChange({ kind: "number", value: Number(e.target.value) })}
            sx={{ width: 140 }}
          />
        </Stack>
      );

    case "string":
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label="str" variant="outlined" />
          <TextField
            size="small"
            value={node.value}
            onChange={(e) => onChange({ kind: "string", value: e.target.value })}
            sx={{ flex: 1 }}
            placeholder="строка"
          />
        </Stack>
      );

    case "var":
      return <VarEditor path={node.path} onChange={(p) => onChange({ kind: "var", path: p })} />;

    case "compare":
      return (
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip size="small" color="primary" label="compare" />
            <Select
              size="small"
              value={node.op}
              onChange={(e) =>
                onChange({ ...node, op: e.target.value as ComparisonOp })
              }
              sx={{ width: 80 }}
            >
              {COMPARISON_OPS.map((op) => (
                <MenuItem key={op} value={op}>
                  {op}
                </MenuItem>
              ))}
            </Select>
          </Stack>
          <JsonLogicVisual
            node={node.left}
            onChange={(n) => onChange({ ...node, left: n })}
            depth={depth + 1}
          />
          <JsonLogicVisual
            node={node.right}
            onChange={(n) => onChange({ ...node, right: n })}
            depth={depth + 1}
          />
        </Stack>
      );

    case "in":
      return (
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip size="small" color="primary" label="in (contains)" />
          </Stack>
          <JsonLogicVisual
            node={node.needle}
            onChange={(n) => onChange({ ...node, needle: n })}
            depth={depth + 1}
          />
          <JsonLogicVisual
            node={node.haystack}
            onChange={(n) => onChange({ ...node, haystack: n })}
            depth={depth + 1}
          />
        </Stack>
      );

    case "and":
    case "or": {
      const op = node.kind;
      return (
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip size="small" color="secondary" label={op.toUpperCase()} />
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Добавить условие">
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  onChange({ ...node, children: [...node.children, defaultLeaf()] })
                }
              >
                +
              </Button>
            </Tooltip>
          </Stack>
          {node.children.map((child, i) => (
            <JsonLogicVisual
              key={i}
              node={child}
              onChange={(n) => {
                const next = [...node.children];
                next[i] = n;
                onChange({ ...node, children: next });
              }}
              onDelete={
                node.children.length > 1
                  ? () => {
                      const next = node.children.filter((_, j) => j !== i);
                      onChange({ ...node, children: next });
                    }
                  : undefined
              }
              depth={depth + 1}
            />
          ))}
        </Stack>
      );
    }

    case "not":
      return (
        <Stack spacing={0.5}>
          <Chip size="small" color="warning" label="NOT" sx={{ alignSelf: "flex-start" }} />
          <JsonLogicVisual
            node={node.child}
            onChange={(n) => onChange({ ...node, child: n })}
            depth={depth + 1}
          />
        </Stack>
      );

    case "unknown":
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" color="error" icon={<CodeIcon />} label="raw JSONLogic" />
          <Box
            component="pre"
            sx={{
              flex: 1,
              fontFamily: "monospace",
              fontSize: 11,
              m: 0,
              bgcolor: "background.default",
              p: 0.5,
              borderRadius: 0.5,
              overflow: "auto",
              maxHeight: 80,
            }}
          >
            {JSON.stringify(node.raw)}
          </Box>
        </Stack>
      );
  }
};

// === смена типа узла ===

const KIND_OPTIONS: Array<{ value: LogicNode["kind"]; label: string }> = [
  { value: "boolean", label: "bool" },
  { value: "number", label: "num" },
  { value: "string", label: "str" },
  { value: "var", label: "var" },
  { value: "compare", label: "==" },
  { value: "in", label: "in" },
  { value: "and", label: "AND" },
  { value: "or", label: "OR" },
  { value: "not", label: "NOT" },
];

const KindSwitcher = ({
  node,
  onChange,
}: {
  node: LogicNode;
  onChange: (n: LogicNode) => void;
}) => {
  const handleChange = (kind: LogicNode["kind"]) => {
    if (kind === node.kind) return;
    onChange(blankOfKind(kind));
  };
  return (
    <Select
      size="small"
      value={node.kind === "unknown" ? "" : node.kind}
      onChange={(e) => handleChange(e.target.value as LogicNode["kind"])}
      displayEmpty
      sx={{ width: 90, fontSize: 11 }}
      renderValue={(v) =>
        node.kind === "unknown" ? "raw" : (v as string)
      }
    >
      {KIND_OPTIONS.map((opt) => (
        <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 12 }}>
          {opt.label}
        </MenuItem>
      ))}
    </Select>
  );
};

function blankOfKind(kind: LogicNode["kind"]): LogicNode {
  switch (kind) {
    case "boolean":
      return { kind: "boolean", value: true };
    case "number":
      return { kind: "number", value: 0 };
    case "string":
      return { kind: "string", value: "" };
    case "var":
      return { kind: "var", path: "state." };
    case "compare":
      return defaultCompare();
    case "in":
      return {
        kind: "in",
        needle: { kind: "string", value: "" },
        haystack: { kind: "var", path: "state." },
      };
    case "and":
      return { kind: "and", children: [defaultLeaf(), defaultLeaf()] };
    case "or":
      return { kind: "or", children: [defaultLeaf(), defaultLeaf()] };
    case "not":
      return { kind: "not", child: defaultLeaf() };
    case "unknown":
      return { kind: "unknown", raw: null };
  }
}

// === var-редактор с автодополнением ===

const VarEditor = memo(function VarEditor({
  path,
  onChange,
}: {
  path: string;
  onChange: (p: string) => void;
}) {
  const steps = useEditorStore((s) => s.scenario?.steps);

  // Простые варианты автокомплита: "state.<id>", "state.<id>.value",
  // "state.<id>.options.<optId>". Без рантайм-валидации значений —
  // jsonLogic.apply может работать на любом state.
  const suggestions = useMemo(() => {
    const out: string[] = [];
    if (!steps) return out;
    for (const s of steps) {
      out.push(`state.${s.id}`);
      out.push(`state.${s.id}.value`);
      const view = (s as { view?: { options?: { id: string }[] } }).view;
      if (view?.options) {
        for (const o of view.options) out.push(`state.${s.id}.options.${o.id}`);
      }
    }
    return out;
  }, [steps]);

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip size="small" label="var" variant="outlined" />
      <Autocomplete
        freeSolo
        size="small"
        value={path}
        onChange={(_, v) => onChange(typeof v === "string" ? v : path)}
        onInputChange={(_, v) => onChange(v)}
        options={suggestions}
        sx={{ flex: 1, minWidth: 200 }}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder="state.step_id.value"
            inputProps={{
              ...params.inputProps,
              style: { fontFamily: "monospace", fontSize: 12 },
            }}
          />
        )}
      />
    </Stack>
  );
});
