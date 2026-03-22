import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

import buildEntrypoints from "../esbuild.entrypoints";

// Start build if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      await module.exports.start();
    } catch (err) {
      console.log("[build] ERROR:", err);
      process.exit(1);
    }
  });
}

export const start = async () => {
  console.log("[build] Starting build");

  console.log(`[build] node: ${process.version}`.trim());

  const buildFolder = path.join("../build");

  console.log("[build] Building entry.main.min.js and entry.preload.min.js");
  await buildEntrypoints({
    mode: "production",
  });

  // Copy necessary files
  console.log("[build] Copying files");
  const copyFiles = async (relSource: string, relDest: string) => {
    const src = path.resolve(__dirname, relSource);
    const dest = path.resolve(__dirname, relDest);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest, { recursive: true, verbatimSymlinks: true });
  };
  await copyFiles("../.vite", buildFolder);
  // await copyFiles("../public", buildFolder);

  console.log("[build] Complete!");
};
