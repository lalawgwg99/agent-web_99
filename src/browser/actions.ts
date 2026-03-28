import { RefMap } from "./ref-map.js";
import type { BrowserSession } from "./manager.js";

export type ActionType =
  | "click"
  | "fill"
  | "select"
  | "scroll"
  | "press"
  | "hover";

export interface ActionOptions {
  action: ActionType;
  ref?: string;
  value?: string;
  session: BrowserSession;
  refMap: RefMap;
}

/**
 * 執行瀏覽器操作
 */
export async function performAction(options: ActionOptions): Promise<string> {
  const { action, ref, value, session, refMap } = options;
  const page = session.page;

  switch (action) {
    case "click": {
      const locator = resolveLocator(page, ref, refMap);
      await locator.click();
      return `Clicked ${ref ?? "page"}`;
    }

    case "fill": {
      if (!value) throw new Error("fill requires a value");
      const locator = resolveLocator(page, ref, refMap);
      await locator.fill(value);
      return `Filled ${ref ?? "element"} with "${value}"`;
    }

    case "select": {
      if (!value) throw new Error("select requires a value");
      const locator = resolveLocator(page, ref, refMap);
      await locator.selectOption(value);
      return `Selected "${value}" on ${ref ?? "element"}`;
    }

    case "hover": {
      const locator = resolveLocator(page, ref, refMap);
      await locator.hover();
      return `Hovered on ${ref ?? "element"}`;
    }

    case "press": {
      if (!value) throw new Error("press requires a key name");
      await page.keyboard.press(value);
      return `Pressed ${value}`;
    }

    case "scroll": {
      // Support "direction:amount" format (e.g. "down:1000", "up:500")
      // Plain direction string (e.g. "down") uses default 500px
      let direction = value ?? "down";
      let amount = 500;

      if (direction.includes(":")) {
        const colonIdx = direction.indexOf(":");
        const amtStr = direction.slice(colonIdx + 1);
        direction = direction.slice(0, colonIdx);
        const parsed = parseInt(amtStr, 10);
        if (!isNaN(parsed) && parsed > 0) amount = parsed;
      }

      const scrollMap: Record<string, [number, number]> = {
        up: [0, -amount],
        down: [0, amount],
        left: [-amount, 0],
        right: [amount, 0],
      };
      const [x, y] = scrollMap[direction] ?? [0, amount];
      await page.mouse.wheel(x, y);
      return `Scrolled ${direction} by ${amount}px`;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveLocator(page: any, ref: string | undefined, refMap: RefMap): any {
  if (!ref) throw new Error("This action requires a @ref target");

  const entry = refMap.resolve(ref);
  if (!entry) {
    throw new Error(
      `Ref "${ref}" not found. Run snapshot first to get fresh refs.`,
    );
  }

  if (entry.name) {
    return page.getByRole(entry.role, { name: entry.name });
  }
  return page.getByRole(entry.role);
}
