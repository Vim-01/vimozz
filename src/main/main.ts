import * as dotenv from 'dotenv';
dotenv.config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
import { CallbackServer } from './services/callbackServer';
import { TwitchAuthService } from './services/twitchAuthService';
import { EventSubService, RewardRedemption } from './services/eventSubService';
import { BypassService } from './services/bypassService';
const { session } = require('electron');

const twitchAuthService = new TwitchAuthService();
const eventSubService = new EventSubService();
const callbackServer = new CallbackServer(twitchAuthService);
const bypassService = new BypassService();

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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Twitch
ipcMain.handle('twitch-login', async () => {
  await twitchAuthService.startAuth();
});

ipcMain.handle('initialize-eventsub', async (event: any, tokens: { accessToken: string, refreshToken: string }) => {
  try {
    const userId = await eventSubService.initialize(
      tokens.accessToken,
      tokens.refreshToken,
      process.env.TWITCH_CLIENT_ID || '',
      process.env.TWITCH_CLIENT_SECRET || ''
    );

    eventSubService.setRewardRedemptionCallback((redemption: RewardRedemption) => {
      if (mainWindow) {
        mainWindow.webContents.send('reward-redemption', redemption);
      }
    });

    await eventSubService.listenToChannelPoints();

    return { success: true, userId };
  } catch (error) {
    console.error('Error initializing EventSub:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-obs-window-id', () => {
  return obsWindow?.id;
});

ipcMain.handle('start-vless', async (event, vlessUrl: string) => {
  try {
    const port = await bypassService.startVless(vlessUrl);
    await session.defaultSession.setProxy({
      proxyRules: `socks5://127.0.0.1:${port}`,
      proxyBypassRules: 'localhost,127.0.0.1,::1'
    });
    return { success: true };
  } catch (error: any) {
    console.error('Failed to start VLESS proxy:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-vless', async () => {
  bypassService.stop();
  await session.defaultSession.setProxy({ proxyRules: '', proxyBypassRules: '' });
  return { success: true };
});

ipcMain.handle('fetch-youtube-title', async (event, videoId: string) => {
  try {
    const axios = require('axios');
    const response = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    return response.data.title || 'Unknown Title';
  } catch (error) {
    console.error('Failed to fetch youtube title:', error);
    return 'Unknown Title';
  }
});