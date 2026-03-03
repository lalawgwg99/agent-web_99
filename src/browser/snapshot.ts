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

interface AXNode {
  role: string;
  name?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  level?: number;
  children?: AXNode[];
}

/**
 * 從 Playwright Page 取得 snapshot
 */
export async function takeSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  refMap: RefMap,
  options: { interactiveOnly?: boolean } = {},
): Promise<SnapshotResult> {
  const axTree = await page.accessibility.snapshot({ interestingOnly: true });

  refMap.clear();

  const tree = axTree ? processNode(axTree, refMap, options.interactiveOnly ?? true) : [];
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

function processNode(
  node: AXNode,
  refMap: RefMap,
  interactiveOnly: boolean,
): SnapshotNode[] {
  const results: SnapshotNode[] = [];
  const isInteractive = INTERACTIVE_ROLES.has(node.role);

  if (!interactiveOnly || isInteractive) {
    const ref = isInteractive ? refMap.assign(node.role, node.name ?? "") : "";

    const snapshotNode: SnapshotNode = {
      ref,
      role: node.role,
      name: node.name ?? "",
      ...(node.value !== undefined && { value: node.value }),
      ...(node.checked !== undefined && { checked: node.checked }),
      ...(node.disabled && { disabled: true }),
      ...(node.level !== undefined && { level: node.level }),
    };

    if (node.children?.length) {
      const children = node.children.flatMap((child) =>
        processNode(child, refMap, interactiveOnly),
      );
      if (children.length > 0) {
        snapshotNode.children = children;
      }
    }

    results.push(snapshotNode);
  } else if (node.children) {
    for (const child of node.children) {
      results.push(...processNode(child, refMap, interactiveOnly));
    }
  }

  return results;
}

/**
 * 渲染為 AI 消費的扁平文字格式
 */
function renderTreeToText(nodes: SnapshotNode[], indent: number): string {
  const lines: string[] = [];
  const pad = "  ".repeat(indent);

  for (const node of nodes) {
    let line = pad;

    if (node.ref) {
      line += `[@${node.ref}] `;
    }

    line += node.role;

    if (node.name) {
      line += ` "${node.name}"`;
    }
    if (node.value !== undefined) {
      line += ` value="${node.value}"`;
    }
    if (node.checked !== undefined) {
      line += node.checked ? " [checked]" : " [unchecked]";
    }
    if (node.disabled) {
      line += " [disabled]";
    }

    lines.push(line);

    if (node.children) {
      const childText = renderTreeToText(node.children, indent + 1);
      if (childText) lines.push(childText);
    }
  }

  return lines.join("\n");
}
