/**
 * @ref 元素映射表
 * 將 Playwright 無障礙樹節點映射到穩定的 @eN 引用
 */

export interface RefEntry {
  ref: string;
  role: string;
  name: string;
  locatorStrategy: string;
}

export class RefMap {
  private counter = 0;
  private map = new Map<string, RefEntry>();

  clear(): void {
    this.counter = 0;
    this.map.clear();
  }

  assign(role: string, name: string): string {
    const ref = `e${++this.counter}`;
    this.map.set(ref, {
      ref,
      role,
      name,
      locatorStrategy: this.buildLocator(role, name),
    });
    return ref;
  }

  resolve(ref: string): RefEntry | undefined {
    const key = ref.startsWith("@") ? ref.slice(1) : ref;
    return this.map.get(key);
  }

  size(): number {
    return this.map.size;
  }

  private buildLocator(role: string, name: string): string {
    if (name) {
      const escaped = name.replace(/'/g, "\\'");
      return `getByRole('${role}', { name: '${escaped}' })`;
    }
    return `getByRole('${role}')`;
  }
}
