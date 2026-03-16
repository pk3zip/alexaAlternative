import { build } from "esbuild";

build({
  sourcemap: true,
  entryPoints: ["src/index.ts"],
  outdir: "dist",
  bundle: true,
  packages: "external",
  format: "esm",
});
