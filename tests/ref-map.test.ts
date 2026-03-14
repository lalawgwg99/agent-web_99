import { describe, it, expect, beforeEach } from "vitest";
import { RefMap } from "../src/browser/ref-map.js";

describe("RefMap", () => {
  let map: RefMap;

  beforeEach(() => {
    map = new RefMap();
  });

  it("starts empty", () => {
    expect(map.size()).toBe(0);
  });

  it("assigns sequential refs starting from e1", () => {
    const r1 = map.assign("button", "Submit");
    const r2 = map.assign("link", "Home");
    expect(r1).toBe("e1");
    expect(r2).toBe("e2");
    expect(map.size()).toBe(2);
  });

  it("resolves refs with @ prefix", () => {
    map.assign("textbox", "Email");
    const entry = map.resolve("@e1");
    expect(entry).toBeDefined();
    expect(entry!.role).toBe("textbox");
    expect(entry!.name).toBe("Email");
  });

  it("resolves refs without @ prefix", () => {
    map.assign("button", "OK");
    const entry = map.resolve("e1");
    expect(entry).toBeDefined();
    expect(entry!.ref).toBe("e1");
  });

  it("returns undefined for unknown refs", () => {
    expect(map.resolve("@e99")).toBeUndefined();
  });

  it("builds locator strategy with name", () => {
    map.assign("button", "Save");
    const entry = map.resolve("e1");
    expect(entry!.locatorStrategy).toBe("getByRole('button', { name: 'Save' })");
  });

  it("builds locator strategy without name", () => {
    map.assign("button", "");
    const entry = map.resolve("e1");
    expect(entry!.locatorStrategy).toBe("getByRole('button')");
  });

  it("escapes single quotes in locator names", () => {
    map.assign("button", "It's OK");
    const entry = map.resolve("e1");
    expect(entry!.locatorStrategy).toContain("It\\'s OK");
  });

  it("clear resets counter and map", () => {
    map.assign("a", "1");
    map.assign("b", "2");
    map.clear();
    expect(map.size()).toBe(0);
    // Counter should reset, so next assign is e1 again
    const ref = map.assign("c", "3");
    expect(ref).toBe("e1");
  });
});
