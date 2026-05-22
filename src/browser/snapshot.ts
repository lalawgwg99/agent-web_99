import yaml from "yaml";
import { RefMap } from "./ref-map.js";

/**
 * Snapshot 節點
 */
export interface SnapshotNode {
  ref: string;
  role: string;
  name: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  level?: number;
  children?: SnapshotNode[];
}

export interface SnapshotResult {
  url: string;
  title: string;
  text: string;
  tree: SnapshotNode[];
  refCount: number;
  timestamp: string;
}

/** 可互動的 ARIA 角色 */
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "switch",
  "slider",
  "spinbutton",
  "searchbox",
  "option",
  "treeitem",
]);

/**
 * 從 Playwright Page 取得 snapshot
 * 使用 locator.ariaSnapshot() API（Playwright 1.49+）
 */
export async function takeSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  refMap: RefMap,
  options: { interactiveOnly?: boolean } = {},
): Promise<SnapshotResult> {
  const ariaYaml: string = await page.locator("body").ariaSnapshot();

  refMap.clear();

  const tree = parseAriaYaml(ariaYaml, refMap, options.interactiveOnly ?? true);
  const text = renderTreeToText(tree, 0);

  return {
    url: page.url(),
    title: await page.title(),
    text,
    tree,
    refCount: refMap.size(),
    timestamp: new Date().toISOString(),
  };
}

interface ParsedNodeKey {
  role: string;
  name: string;
  level?: number;
  checked?: boolean;
  disabled: boolean;
}

/**
 * Parse a single ARIA node key string, e.g.:
 *   heading "Example Domain" [level=1]
 *   link "Learn more"
 *   checkbox "Option" [checked]
 *   textbox "Search" [disabled]
 */
function parseNodeKey(key: string): ParsedNodeKey | null {
  const trimmed = key.trim();
  if (!trimmed) return null;

  const roleMatch = trimmed.match(/^(\w+)(.*)/);
  if (!roleMatch) return null;

  const role = roleMatch[1]!;
  let rest = roleMatch[2]!.trim();

  // Skip ARIA metadata entries like /url
  if (role.startsWith("/")) return null;

  // Parse name (quoted string after role)
  let name = "";
  const nameMatch = rest.match(/^"(.+?)"/);
  if (nameMatch) {
    name = nameMatch[1]!;
    rest = rest.slice(nameMatch[0].length).trim();
  } else if (rest.startsWith(":")) {
    // "- role: text" format
    name = rest.slice(1).trim();
    rest = "";
  }

  // Parse attributes [level=N], [checked], [unchecked], [disabled]
  let level: number | undefined;
  let checked: boolean | undefined;
  let disabled = false;

  const attrMatches = rest.match(/\[([^\]]+)\]/g);
  if (attrMatches) {
    for (const attr of attrMatches) {
      const inner = attr.slice(1, -1);
      if (inner.startsWith("level=")) {
        level = parseInt(inner.slice(6), 10);
      } else if (inner === "checked") {
        checked = true;
      } else if (inner === "unchecked") {
        checked = false;
      } else if (inner === "disabled") {
        disabled = true;
      }
    }
  }

  return { role, name, level, checked, disabled };
}

/**
 * Recursively process a list of items produced by yaml.parse() into SnapshotNodes.
 * Each item is either:
 *   - a string  (leaf node: "heading \"Title\" [level=1]")
 *   - an object (node with children: { 'link "Text"': [...children] })
 */
function processItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[],
  refMap: RefMap,
  interactiveOnly: boolean,
): SnapshotNode[] {
  const result: SnapshotNode[] = [];

  for (const item of items) {
    if (item === null || item === undefined) continue;

    let nodeKey: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let childItems: any[] | undefined;

    if (typeof item === "string") {
      nodeKey = item;
    } else if (typeof item === "object" && !Array.isArray(item)) {
      const keys = Object.keys(item);
      if (keys.length === 0) continue;
      nodeKey = keys[0]!;
      // Skip ARIA metadata entries (e.g. /url, /value)
      if (nodeKey.startsWith("/")) continue;
      const childVal = (item as Record<string, unknown>)[nodeKey];
      childItems = Array.isArray(childVal) ? childVal : undefined;
    } else {
      continue;
    }

    const parsed = parseNodeKey(nodeKey);
    if (!parsed) continue;

    const { role, name, level, checked, disabled } = parsed;
    const isInteractive = INTERACTIVE_ROLES.has(role);

    if (interactiveOnly && !isInteractive) {
      // Don't add this node, but still recurse to find interactive children
      if (childItems && childItems.length > 0) {
        result.push(...processItems(childItems, refMap, interactiveOnly));
      }
      continue;
    }

    const ref = isInteractive ? refMap.assign(role, name) : "";
    const node: SnapshotNode = {
      ref,
      role,
      name,
      ...(level !== undefined && { level }),
      ...(checked !== undefined && { checked }),
      ...(disabled && { disabled }),
    };

    if (childItems && childItems.length > 0) {
      const childNodes = processItems(childItems, refMap, interactiveOnly);
      if (childNodes.length > 0) {
        node.children = childNodes;
      }
    }

    result.push(node);
  }

  return result;
}

/**
 * Parse the ARIA YAML string returned by ariaSnapshot() using the 'yaml' package
 * for robust structure parsing, then walk the resulting tree to extract nodes
 * and assign @ref identifiers to interactive elements.
 */
function parseAriaYaml(
  yamlStr: string,
  refMap: RefMap,
  interactiveOnly: boolean,
): SnapshotNode[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = yaml.parse(yamlStr);
  } catch {
    // Graceful fallback if YAML parsing fails for any reason
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return processItems(parsed, refMap, interactiveOnly);
}

/**
 * 生成緩存的縮進字符串
 */
const INDENT_CACHE: string[] = [];
function getIndent(level: number): string {
  if (!INDENT_CACHE[level]) {
    INDENT_CACHE[level] = "  ".repeat(level);
  }
  return INDENT_CACHE[level]!;
}

/**
 * 渲染為 AI 消費的扁平文字格式
 * 效能優化：使用字符串緩衝和縮進緩存
 */
function renderTreeToText(nodes: SnapshotNode[], indent: number): string {
  // 不需要預先估計長度，只預分配陣列
  const lines: string[] = [];
  lines.length = nodes.length; // 預分配數組大小
  
  const pad = getIndent(indent);
  let lineIndex = 0;

  for (const node of nodes) {
    // 使用數組串接而非字符串連接以提高效能
    const parts: string[] = [pad];

    if (node.ref) {
      parts.push(`[@${node.ref}] `);
    }

    parts.push(node.role);

    if (node.name) {
      parts.push(` "${node.name}"`);
    }
    if (node.value !== undefined) {
      parts.push(` value="${node.value}"`);
    }
    if (node.checked !== undefined) {
      parts.push(node.checked ? " [checked]" : " [unchecked]");
    }
    if (node.disabled) {
      parts.push(" [disabled]");
    }
    if (node.level !== undefined) {
      parts.push(` [level=${node.level}]`);
    }

    lines[lineIndex++] = parts.join('');

    if (node.children && node.children.length > 0) {
      const childText = renderTreeToText(node.children, indent + 1);
      if (childText) {
        // 使用 concat 而不是 push + spread 來減少記憶體使用
        lines[lineIndex++] = childText;
      }
    }
  }

  // 過濾未使用的預分配空間
  return lines.filter(Boolean).join("\n");
}
