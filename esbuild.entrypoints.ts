import { type ChildProcess, spawn } from "node:child_process";
import { builtinModules } from "node:module";
import path from "node:path";

import esbuild, { type BuildOptions, type Plugin } from "esbuild";

interface Options {
  mode?: "development" | "production";
  autoRestart?: boolean;
}
const inspectPort = process.env.INSPECT_PORT || "5858";

export default async function build(options: Options) {
  const mode = options.mode || "production";
  const __DEV__ = mode !== "production";
  const autoRestart = options.autoRestart || false;

  const outdir = path.join(__dirname, "../build");
  console.log("[build] outdir:", outdir);

  const env: Record<string, string> = __DEV__
    ? {
        "process.env.NODE_ENV": JSON.stringify("development"),
        "process.env.BUILD_DATE": JSON.stringify(new Date()),
      }
    : {
        "process.env.NODE_ENV": JSON.stringify("production"),
        "process.env.BUILD_DATE": JSON.stringify(new Date()),
      };

  const preloadBuildOptions: BuildOptions = {
    entryPoints: ["./electron/preload.ts"],
    outfile: path.join(outdir, "preload.js"),
    target: "esnext",
    bundle: true,
    platform: "node",
    sourcemap: true,
    format: "cjs",
    external: ["electron", "esbuild"],
  };

  const mainBuildOptions: BuildOptions = {
    entryPoints: ["./electron/entry.main.ts"],
    outfile: path.join(outdir, "entry.main.js"),
    bundle: true,
    platform: "node",
    sourcemap: true,
    format: "cjs",
    define: env,
    external: ["electron", "esbuild", ...Object.keys(builtinModules)],
  };

  let electronProcess: ChildProcess;
  const startElectron = () => {
    electronProcess = spawn("electron", [`--inspect=${inspectPort}`, "."], {
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
  };

  if (__DEV__ && autoRestart) {
    // build script with auto reload
    console.log("[Dev Build] Watching for main process changes...");
    let buildCount = 0;
    const restartElectronPlugin = (scriptName: string): Plugin => ({
      name: "restart-electron",
      setup: (build) => {
        build.onStart(() => {
          console.log(`[Dev Build] Detecting changes, rebuild ${scriptName}`);
        });
        build.onEnd(() => {
          buildCount++;
          // first build after main/preload is built
          if (buildCount === 2) {
            console.log("[Dev Build] Build complete, start Electron");
            startElectron();
          } else if (buildCount > 2) {
            console.log(
              `[Dev Build] Finish rebuilding ${scriptName}, restarting Electron`,
            );
            restartElectronProcess();
          } else {
            console.log(
              `[Dev Build] Skip restarting Electron for ${scriptName} since it is the first rebuild`,
            );
          }
        });
      },
    });
    const preloadContext = await esbuild.context({
      ...preloadBuildOptions,
      plugins: [restartElectronPlugin("preload")],
    });
    const mainContext = await esbuild.context({
      ...mainBuildOptions,
      plugins: [restartElectronPlugin("main")],
    });

    const restartElectronProcess = () => {
      console.log("[Dev Build] Start restarting Electron");

      if (electronProcess) {
        electronProcess.once("exit", () => {
          console.log("[Dev Build] Electron exited");
          startElectron();
        });

        //Shutdown electron first. Existing debugger inspector will be closed in quit event of the app.
        electronProcess.kill();
      }
    };

    const preloadWatch = await preloadContext.watch();
    const mainWatch = await mainContext.watch();
    return Promise.all([preloadWatch, mainWatch]);
  }
  const preload = esbuild.build(preloadBuildOptions);
  const main = esbuild.build(mainBuildOptions);
  return Promise.all([main, preload]).catch((err) => {
    console.error("[Build] Build failed:", err);
  });
}

// Build if ran as a cli script
const isMain = require.main === module;

if (isMain) {
  const mode =
    process.env.NODE_ENV === "development" ? "development" : "production";
  const autoRestart = process.argv.includes("--autoRestart");
  build({ mode, autoRestart });
}
