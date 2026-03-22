const BINARY_PREFIX = "PDFEdit";

/**
 * electron-builder configuration
 * Docs: https://www.electron.build/configuration/configuration
 */

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: "lanlp.app.pdfedit",
  productName: "PDFEdit",
  copyright: `Copyright © ${new Date().getFullYear()}`,

  // Files to include in the packaged app
  files: [
    {
      from: "./build",
      to: ".",
      filter: ["**/*", "!**/*.map"],
    },
    "package.json",
  ],

  extraMetadata: {
    main: "entry.main.js", // Override the main path in package.json
  },

  directories: {
    output: "out",
    buildResources: "Assets",
  },

  fileAssociations: [
    {
      ext: "pdf",
      name: "PDF File",
      role: "Editor",
    },
  ],

  // ── Windows ──────────────────────────────────────────────────────────────
  win: {
    target: [
      {
        target: "nsis", // Wizard-style installer
        arch: ["x64", "arm64"],
      },
      {
        target: "portable", // Single .exe, no install
        arch: ["x64"],
      },
    ],
    icon: "./src/assets/icon.ico",
  },
  nsis: {
    artifactName: `${BINARY_PREFIX}-nsis-\${version}.\${ext}`,
    oneClick: false,
    selectPerMachineByDefault: true,
    allowToChangeInstallationDirectory: true,
    installerIcon: "./src/assets/icon.ico",
    uninstallerIcon: "./src/assets/icon.ico",
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "PDFEdit",
    deleteAppDataOnUninstall: false,
  },
  squirrelWindows: {
    artifactName: `${BINARY_PREFIX}-\${version}.\${ext}`,
    iconUrl:
      "https://github.com/LanLP0/PDFEdit/blob/main/src/assets/icon.ico?raw=true",
  },
  portable: {
    artifactName: `${BINARY_PREFIX}-\${version}-portable.\${ext}`,
  },

  // ── macOS ────────────────────────────────────────────────────────────────
  mac: {
    target: [
      {
        target: "dmg",
        arch: ["arm64"],
      },
      {
        target: "zip",
        arch: ["arm64"],
      },
    ],
    artifactName: `${BINARY_PREFIX}-\${version}.\${ext}`,
    icon: "./src/assets/icon.icns",
    category: "public.app-category.productivity",
    // Set to your Apple Developer Team ID to enable code signing:
    // identity: 'Developer ID Application: Your Name (TEAMID)',
  },
  dmg: {
    backgroundColor: "#1a1a2e",
    window: { width: 540, height: 380 },
  },

  // ── Linux ────────────────────────────────────────────────────────────────
  linux: {
    artifactName: `${BINARY_PREFIX}-\${version}-\${arch}.\${ext}`,
    executableName: "PDFEdit",
    target: [{ target: "AppImage" }, { target: "deb" }, { target: "rpm" }],
    icon: "./src/assets/icon.png",
    category: "Office",
    desktop: {
      entry: {
        Name: "PDFEdit",
        Comment: "Edit and annotate PDF files",
      },
    },
  },
};

const {
  env: { BUILD_TARGETS },
  platform,
} = process;
const targets = BUILD_TARGETS?.split(",");
if (platform && targets) {
  console.log("overriding build targets to: ", targets);
  const PLATFORM_MAP = { darwin: "mac", linux: "linux", win32: "win" };
  config[PLATFORM_MAP[platform]].target = config[
    PLATFORM_MAP[platform]
  ].target.filter(({ target }) => targets.includes(target));
}
module.exports = config;
