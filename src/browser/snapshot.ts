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

/**
 * 解析 ariaSnapshot() 回傳的 YAML 格式
 * 格式範例：
 *   - heading "Example Domain" [level=1]
 *   - link "Learn more":
 *     - /url: https://example.com
 */
function parseAriaYaml(
  yaml: string,
  refMap: RefMap,
  interactiveOnly: boolean,
): SnapshotNode[] {
  const lines = yaml.split("\n");
  const root: SnapshotNode[] = [];
  const stack: { indent: number; children: SnapshotNode[] }[] = [
    { indent: -1, children: root },
  ];

  for (const line of lines) {
    // Skip empty lines and metadata lines (like /url:)
    if (!line.trim() || line.trim().startsWith("/")) continue;

    const match = line.match(/^(\s*)- (\w+)(.*)/);
    if (!match) continue;

    const indent = match[1]!.length;
    const role = match[2]!;
    let rest = match[3]!.trim();

    // Skip metadata entries
    if (role === "text" && rest.startsWith(":")) continue;

    // Parse name (quoted string after role)
    let name = "";
    const nameMatch = rest.match(/^"(.+?)"/);
    if (nameMatch) {
      name = nameMatch[1]!;
      rest = rest.slice(nameMatch[0].length).trim();
    } else if (rest.startsWith(":")) {
      // "- text: Some text" format
      name = rest.slice(1).trim();
      rest = "";
    }

    // Parse attributes like [level=1], [checked], [disabled]
    let level: number | undefined;
    let checked: boolean | undefined;
    let disabled = false;

    const attrMatch = rest.match(/\[([^\]]+)\]/g);
    if (attrMatch) {
      for (const attr of attrMatch) {
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

    const isInteractive = INTERACTIVE_ROLES.has(role);

    if (interactiveOnly && !isInteractive) {
      // Non-interactive: we still need to track indent for tree structure,
      // but won't add a node. Its children may be interactive though.
      // Add a transparent container
      while (stack.length > 1 && stack[stack.length - 1]!.indent >= indent) {
        stack.pop();
      }
      // Push a virtual container so interactive children get added to parent
      stack.push({ indent, children: stack[stack.length - 1]!.children });
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

    // Find the correct parent based on indentation
    while (stack.length > 1 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]!;
    parent.children.push(node);

    // This node can be a parent for deeper-indented nodes
    const nodeChildren: SnapshotNode[] = [];
    node.children = nodeChildren;
    stack.push({ indent, children: nodeChildren });
  }

  // Clean up: remove empty children arrays
  cleanEmptyChildren(root);

  return root;
}

function cleanEmptyChildren(nodes: SnapshotNode[]): void {
  for (const node of nodes) {
    if (node.children) {
      if (node.children.length === 0) {
        delete node.children;
      } else {
        cleanEmptyChildren(node.children);
      }
    }
  }
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
