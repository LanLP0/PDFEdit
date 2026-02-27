import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// app.isPackaged is false during development, true when built by electron-builder.
// This is the only reliable way to detect production — process.env.NODE_ENV is
// often undefined in packaged Electron apps.
const isDev = !app.isPackaged;

// Keep a global reference to avoid GC
let mainWindow: BrowserWindow | null = null;

// File path queued from `open-file` event (macOS) before window is ready
let queuedFilePath: string | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false,
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow!.show();

        // Send queued file path (macOS open-file before ready)
        if (queuedFilePath) {
            mainWindow!.webContents.send('open-file', queuedFilePath);
            queuedFilePath = null;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.removeMenu();
    // buildMenu();
}

// function buildMenu() {
//     const isMac = process.platform === 'darwin';

//     const template: Electron.MenuItemConstructorOptions[] = [
//         ...(isMac
//             ? [{ role: 'appMenu' as const }]
//             : []),
//         // {
//         //     label: 'File',
//         //     submenu: [
//         //         {
//         //             label: 'Open…',
//         //             accelerator: 'CmdOrCtrl+O',
//         //             click: async () => {
//         //                 const result = await dialog.showOpenDialog(mainWindow!, {
//         //                     title: 'Open PDF',
//         //                     filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
//         //                     properties: ['openFile'],
//         //                 });
//         //                 if (!result.canceled && result.filePaths.length > 0) {
//         //                     mainWindow!.webContents.send('open-file', result.filePaths[0]);
//         //                 }
//         //             },
//         //         },
//         //         { type: 'separator' },
//         //         isMac
//         //             ? { role: 'close' as const }
//         //             : { role: 'quit' as const },
//         //     ],
//         // },
//         {
//             label: 'View',
//             submenu: [
//                 { role: 'reload' as const },
//                 { type: 'separator' as const },
//                 { role: 'resetZoom' as const },
//                 { role: 'zoomIn' as const },
//                 { role: 'zoomOut' as const },
//                 { type: 'separator' as const },
//                 { role: 'togglefullscreen' as const },
//             ],
//         },
//         {
//             label: 'Help',
//             submenu: [
//                 {
//                     label: 'Learn More',
//                     click: () => shell.openExternal('https://github.com/LanLP0/PDFEdit'),
//                 },
//             ],
//         },
//     ];

//     Menu.setApplicationMenu(Menu.buildFromTemplate(template));
// }

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Open PDF',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save PDF As',
        defaultPath: defaultName,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    return result.canceled ? null : result.filePath;
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    const buffer = await readFile(filePath);
    // Return as a plain object so it survives IPC serialization
    return { buffer: buffer.buffer, byteOffset: buffer.byteOffset, byteLength: buffer.byteLength };
});

ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: ArrayBuffer) => {
    await writeFile(filePath, Buffer.from(data));
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

// macOS: file opened by dragging onto Dock icon
app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow?.webContents.isLoading() === false) {
        mainWindow.webContents.send('open-file', filePath);
    } else {
        queuedFilePath = filePath;
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
