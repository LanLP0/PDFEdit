import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import path from 'path';
import started from 'electron-squirrel-startup';

// Vite-injected constants
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
const iconUrl = join(__dirname, '../src/assets/icon.png');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

const isDev = !app.isPackaged || process.env.IS_DEV === 'true';

// Keep a global reference to avoid GC
let mainWindow: BrowserWindow | null = null;

// File path queued from `open-file` event (macOS) before window is ready
let queuedFilePath: string | null = null;

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, commandLine) => {
        const filePath = commandLine.find(arg => arg.toLowerCase().endsWith('.pdf'));
        if (filePath) {
            createWindow(filePath);
        } else if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        // Check for file in argv on startup (Windows/Linux)
        const filePath = process.argv.find(arg => arg.toLowerCase().endsWith('.pdf'));
        createWindow(filePath);

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
}

// File data to be sent to a new window on startup
type FileOpenData = {
    path?: string;
    bytes?: Uint8Array;
    name: string;
};

function createWindow(initialData?: string | FileOpenData) {
    // const initialFilePath = typeof initialData === 'string' ? initialData : initialData?.path;
    // const initialBytes = typeof initialData === 'object' ? initialData?.bytes : null;

    const win = new BrowserWindow({
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
        icon: iconUrl,
        show: false,
    });

    // If this is the first window, keep a reference
    if (!mainWindow) mainWindow = win;

    if (isDev) {
        win.webContents.openDevTools({ mode: 'detach' });
    }

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(
            path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        );
    }

    win.removeMenu();

    win.once('ready-to-show', () => {
        win.show();

        // Send initial file path or bytes if provided
        if (typeof initialData === 'string') {
            win.webContents.send('open-file', initialData);
        } else if (typeof initialData === 'object' && initialData) {
            win.webContents.send('open-file-payload', initialData);
        } else if (queuedFilePath && win === mainWindow) {
            // Send queued file path (macOS open-file before ready)
            win.webContents.send('open-file', queuedFilePath);
            queuedFilePath = null;
        }
    });

    let canClose = false;

    // Window-specific close check
    const onCloseCallback = (event: Electron.IpcMainEvent) => {
        if (BrowserWindow.fromWebContents(event.sender) === win) {
            canClose = true;
            win.close();
            ipcMain.removeListener('close-callback', onCloseCallback);
        }
    };
    ipcMain.on('close-callback', onCloseCallback);

    win.on('close', (e) => {
        if (canClose) return;
        e.preventDefault();
        win.webContents.send('close-request');
    });

    win.on('closed', () => {
        ipcMain.removeListener('close-callback', onCloseCallback);
        if (win === mainWindow) {
            // Elect a new main window
            const windows = BrowserWindow.getAllWindows();
            mainWindow = windows.length > 0 ? windows[0] : null;
        }
    });
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
        title: 'Open PDF',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog({
        title: 'Save PDF As',
        defaultPath: defaultName,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    return result.canceled ? null : result.filePath;
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    const buffer = await readFile(filePath);
    return { buffer: buffer.buffer, byteOffset: buffer.byteOffset, byteLength: buffer.byteLength };
});

ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: ArrayBuffer) => {
    await writeFile(filePath, Buffer.from(data));
});

ipcMain.handle('app:openInNewWindow', async (_event, data: FileOpenData) => {
    createWindow(data);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (app.isReady()) {
        createWindow(filePath);
    } else {
        queuedFilePath = filePath;
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
