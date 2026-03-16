import { execFile } from "child_process";
import { promisify } from "util";
import which from "which";

const execFilePromise = promisify(execFile);

export class BuildExec {
  private constructor(
    private strings: TemplateStringsArray,
    private values: unknown[],
  ) {}

  static new(strings: TemplateStringsArray, ...values: unknown[]) {
    return new BuildExec(strings, values);
  }

  // Interleave the template parts and values into a flat string,
  // then split on whitespace to get [cmd, ...args] safely.
  private parse(): [string, string[]] {
    const raw = this.strings.reduce((acc, str, i) => {
      const value = this.values[i];
      // Coerce each interpolated value to a string, trim whitespace
      return acc + str + (value !== undefined ? String(value).trim() : "");
    }, "");

    // Split on whitespace, drop empty tokens from leading/trailing spaces
    const parts = raw.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) throw new Error("[BuildExec] empty command");

    const [cmd, ...args] = parts;
    return [cmd, args];
  }

  // Resolves the full absolute path of the binary using PATH lookup.
  // If the cmd already looks like an absolute or relative path, skip lookup.
  private async resolve(cmd: string): Promise<string> {
    if (cmd.startsWith("/") || cmd.startsWith("./") || cmd.startsWith("../")) {
      return cmd; // already a path, trust it as-is
    }
    try {
      return await which(cmd);
    } catch {
      throw new Error(`[BuildExec] command not found on PATH: "${cmd}"`);
    }
  }

  async run(): Promise<{ stdout: string; stderr: string }> {
    const [cmd, args] = this.parse();
    const resolvedCmd = await this.resolve(cmd);
    return execFilePromise(resolvedCmd, args);
  }
}
