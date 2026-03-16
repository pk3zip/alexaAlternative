import { AIManager } from "./aiManager";
import { configType } from "./config";
import { readFileSync, writeFileSync, existsSync } from "fs";

type Primitive = string | number | boolean;
type StorageValue = Primitive | Primitive[];
type StorageData = Record<string, StorageValue>;

export class PersistentStorage {
  private storagePath = this.global_config.STORAGE_PATH;
  private dirty: StorageData = {};
  private deleted = new Set<string>();

  private constructor(
    private ai: AIManager,
    private global_config: configType,
  ) {}

  static new(ai: AIManager, global_config: configType): PersistentStorage {
    const instance = new PersistentStorage(ai, global_config);
    instance.registerTools();
    return instance;
  }

  // --- File I/O ---

  private readDisk(): StorageData {
    if (!existsSync(this.storagePath)) return {};
    try {
      return JSON.parse(readFileSync(this.storagePath, "utf-8"));
    } catch {
      return {};
    }
  }

  // Merges disk + dirty, then removes tombstoned keys
  private read(): StorageData {
    const merged = { ...this.readDisk(), ...this.dirty };
    for (const key of this.deleted) delete merged[key];
    return merged;
  }

  private stage(data: StorageData): void {
    this.dirty = data;
  }

  commit(): void {
    if (
      this.dirty &&
      Object.keys(this.dirty).length === 0 &&
      this.deleted.size === 0
    )
      return;
    const merged = { ...this.readDisk(), ...this.dirty };
    for (const key of this.deleted) delete merged[key];
    writeFileSync(this.storagePath, JSON.stringify(merged, null, 2), "utf-8");
    this.dirty = {};
    this.deleted.clear();
    console.log("[storage] committed to disk.");
  }

  // --- Operations ---

  private listKeys(): string {
    const keys = Object.keys(this.read());
    return keys.length === 0
      ? "No keys in storage."
      : `Keys: ${keys.join(", ")}`;
  }

  private getKey(key: string): string {
    const data = this.read();
    if (!(key in data)) return `Key "${key}" does not exist.`;
    return JSON.stringify(data[key]);
  }

  private setKey(key: string, value: Primitive): string {
    const data = this.read();
    data[key] = value;
    this.deleted.delete(key); // un-tombstone if previously deleted
    this.stage(data);
    return `Set "${key}" to ${JSON.stringify(value)}.`;
  }

  private deleteKey(key: string): string {
    const data = this.read();
    if (!(key in data)) return `Key "${key}" does not exist.`;
    delete this.dirty[key];
    this.deleted.add(key);
    return `Deleted "${key}".`;
  }

  private appendToList(key: string, item: Primitive): string {
    const data = this.read();
    const existing = data[key];
    if (existing !== undefined && !Array.isArray(existing)) {
      return `Key "${key}" exists but is not a list.`;
    }
    data[key] = [...(Array.isArray(existing) ? existing : []), item];
    this.deleted.delete(key);
    this.stage(data);
    return `Appended ${JSON.stringify(item)} to "${key}".`;
  }

  private removeFromList(key: string, index: number): string {
    const data = this.read();
    const existing = data[key];
    if (!Array.isArray(existing)) return `Key "${key}" is not a list.`;
    if (index < 0 || index >= existing.length) {
      return `Index ${index} out of range (list has ${existing.length} items).`;
    }
    const removed = existing[index];
    existing.splice(index, 1);
    data[key] = existing;
    this.stage(data);
    return `Removed item at index ${index} (was ${JSON.stringify(removed)}) from "${key}".`;
  }

  // --- Tool Registration ---

  private registerTools(): void {
    this.ai.registerTool(
      {
        name: "storage",
        description:
          "Read and write persistent storage. Use this to remember lists, notes, reminders, and any data that should survive between conversations.",
        input_schema: {
          type: "object" as const,
          properties: {
            action: {
              type: "string",
              enum: ["list_keys", "get", "set", "delete", "append", "remove"],
              description: [
                "list_keys — list all stored keys",
                "get — get the value of a key",
                "set — set a key to a primitive value (string, number, bool)",
                "delete — delete a key entirely",
                "append — append an item to a list key (creates list if needed)",
                "remove — remove an item from a list key by index",
              ].join("; "),
            },
            key: {
              type: "string",
              description:
                "The key to operate on (required for all except list_keys)",
            },
            value: {
              type: "string",
              description:
                "Value to set or append (required for set and append)",
            },
            index: {
              type: "number",
              description: "Zero-based index to remove (required for remove)",
            },
          },
          required: ["action"],
        },
      },
      async (input) => {
        const { action, key, value, index } = input as {
          action: string;
          key?: string;
          value?: string;
          index?: number;
        };

        if (action === "list_keys") return this.listKeys();
        if (!key) return `Error: "key" is required for action "${action}".`;

        switch (action) {
          case "get":
            return this.getKey(key);
          case "set":
            return value !== undefined
              ? this.setKey(key, value)
              : `Error: "value" required for set.`;
          case "delete":
            return this.deleteKey(key);
          case "append":
            return value !== undefined
              ? this.appendToList(key, value)
              : `Error: "value" required for append.`;
          case "remove":
            return index !== undefined
              ? this.removeFromList(key, index)
              : `Error: "index" required for remove.`;
          default:
            return `Error: unknown action "${action}".`;
        }
      },
    );
  }
}
