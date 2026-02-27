/**
 * electron-builder configuration
 * Docs: https://www.electron.build/configuration/configuration
 */

/** @type {import('electron-builder').Configuration} */
const config = {
    appId: 'com.pdfedit.app',
    productName: 'PDFEdit',
    copyright: `Copyright © ${new Date().getFullYear()}`,

    // Files to include in the packaged app
    files: [
        'dist/**/*',
        'dist-electron/**/*',
        'package.json',
    ],

    directories: {
        output: 'release',
        buildResources: 'Assets',
    },


    // ── Windows ──────────────────────────────────────────────────────────────
    win: {
        target: [
            {
                target: 'nsis',        // Wizard-style installer
                arch: ['x64', 'arm64'],
            },
            {
                target: 'portable',   // Single .exe, no install
                arch: ['x64'],
            },
        ],
        icon: 'Assets/icon.ico',
    },
    nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
    },

    // ── macOS ────────────────────────────────────────────────────────────────
    mac: {
        target: [
            {
                target: 'dmg',
                arch: ['x64', 'arm64'],  // Intel + Apple Silicon
            },
            {
                target: 'zip',
                arch: ['x64', 'arm64'],
            },
        ],
        icon: 'Assets/icon.icns',
        category: 'public.app-category.productivity',
        // Set to your Apple Developer Team ID to enable code signing:
        // identity: 'Developer ID Application: Your Name (TEAMID)',
    },
    dmg: {
        backgroundColor: '#1a1a2e',
        window: { width: 540, height: 380 },
    },

    // ── Linux ────────────────────────────────────────────────────────────────
    linux: {
        target: [
            { target: 'AppImage', arch: ['x64', 'arm64'] },
            { target: 'deb', arch: ['x64'] },
            { target: 'rpm', arch: ['x64'] },
        ],
        icon: 'Assets/icon.png',
        category: 'Office',
        desktop: {
            Name: 'PDFEdit',
            Comment: 'Edit and annotate PDF files',
        },
    },
};

export default config;
