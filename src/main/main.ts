import * as dotenv from 'dotenv';
dotenv.config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
import { CallbackServer } from './services/callbackServer';
import { TwitchAuthService } from './services/twitchAuthService';
import { EventSubService, RewardRedemption } from './services/eventSubService';
import { BypassService } from './services/bypassService';
const { session } = require('electron');

const twitchAuthService = new TwitchAuthService();
const eventSubService = new EventSubService();
const callbackServer = new CallbackServer(twitchAuthService);
const bypassService = new BypassService();

app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
app.commandLine.appendSwitch('ozone-platform', 'wayland');
app.disableHardwareAcceleration();

let mainWindow: any = null;
let obsWindow: any = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    }
  });

  twitchAuthService.setMainWindow(mainWindow);

  obsWindow = new BrowserWindow({
    width: 800,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    }
  });

  mainWindow.loadURL('http://localhost:3000');
  obsWindow.loadURL('http://localhost:3000/#/obs');

  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  bypassService.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  bypassService.stop();
});

// Twitch
ipcMain.handle('twitch-login', async (event, silent = false) => {
  await twitchAuthService.startAuth(silent);
});

ipcMain.handle('initialize-eventsub', async (event: any, tokens: { accessToken: string }) => {
  try {
    const userId = await eventSubService.initialize(
      tokens.accessToken,
      '0w8n7udc1rn3wufaphgjksw1tzt4jb'
    );
    
    eventSubService.setRewardRedemptionCallback((redemption: RewardRedemption) => {
      if (mainWindow) {
        mainWindow.webContents.send('reward-redemption', redemption);
      }
    });

    await eventSubService.listenToChannelPoints();

    return { success: true, userId };
  } catch (error: any) {
    console.error('Failed to initialize EventSub:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-obs-window-id', () => {
  return obsWindow?.id;
});

ipcMain.handle('start-vless', async (event, vlessUrl: string) => {
  try {
    const port = await bypassService.startVless(vlessUrl);
    
    // Electron supports http:// URIs for PAC scripts reliably
    const pacUrl = `http://localhost:3001/proxy.pac?port=${port}`;
    await session.defaultSession.setProxy({ pacScript: pacUrl });
    console.log('PAC script proxy configured successfully:', pacUrl);
    
    // Also set env proxy for Node.js modules (axios, yt-dlp)
    process.env.http_proxy = 'http://127.0.0.1:10809';
    process.env.https_proxy = 'http://127.0.0.1:10809';
    
    return { success: true };
  } catch (error: any) {
    console.error('Failed to start VLESS proxy:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-vless', async () => {
  bypassService.stop();
  await session.defaultSession.setProxy({ proxyRules: '', proxyBypassRules: '' });
  delete process.env.http_proxy;
  delete process.env.https_proxy;
  return { success: true };
});

ipcMain.handle('fetch-youtube-title', async (event, videoId: string) => {
  try {
    const { net } = require('electron');
    return new Promise((resolve) => {
      const request = net.request(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      request.on('response', (response: any) => {
        let data = '';
        response.on('data', (chunk: any) => { data += chunk; });
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.title || 'Unknown Title');
          } catch (e) {
            resolve('Unknown Title');
          }
        });
      });
      request.on('error', (error: any) => {
        console.error('Failed to fetch youtube title:', error);
        resolve('Unknown Title');
      });
      request.end();
    });
  } catch (error) {
    console.error('Failed to fetch youtube title:', error);
    return 'Unknown Title';
  }
});

ipcMain.handle('get-custom-rewards', async () => {
  try {
    return await eventSubService.getCustomRewards();
  } catch (error: any) {
    console.error('Failed to get custom rewards:', error);
    return { error: error.message };
  }
});