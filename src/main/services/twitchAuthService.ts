import axios from 'axios';
const { BrowserWindow } = require('electron');

export class TwitchAuthService {
  private clientId: string;
  private redirectUri: string;
  private accessToken: string | null = null;
  private authWindow: any = null;
  private mainWindow: any = null;

  constructor() {
    this.clientId = '0w8n7udc1rn3wufaphgjksw1tzt4jb';
    this.redirectUri = 'http://localhost:3001/callback';
  }

  setMainWindow(window: any): void {
    this.mainWindow = window;
  }

  async startAuth(silent: boolean = false): Promise<void> {
    const authUrl = `https://id.twitch.tv/oauth2/authorize` +
      `?client_id=${this.clientId}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&response_type=token` +
      `&scope=channel:read:subscriptions+user:read:email+channel:read:redemptions+channel:manage:redemptions`;

    this.authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      show: !silent,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const handleUrl = (url: string) => {
      if (url.startsWith(this.redirectUri)) {
        try {
          const urlObj = new URL(url);
          const hash = urlObj.hash.substring(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          
          if (accessToken) {
            this.accessToken = accessToken;
            if (this.mainWindow) {
              this.mainWindow.webContents.send('twitch-auth-success', { accessToken });
            }
            if (this.authWindow) {
              this.authWindow.close();
              this.authWindow = null;
            }
          }
        } catch (e) {
          console.error('Error parsing token from URL', e);
        }
      }
    };

    this.authWindow.webContents.on('will-navigate', (event: any, url: string) => {
      handleUrl(url);
    });
    
    this.authWindow.webContents.on('did-redirect-navigation', (event: any, url: string) => {
      handleUrl(url);
    });

    try {
      await this.authWindow.loadURL(authUrl);
      
      // If silent auth fails to redirect within 5 seconds, user interaction is likely required.
      if (silent) {
        setTimeout(() => {
          if (this.authWindow && !this.accessToken) {
            this.authWindow.close();
            this.authWindow = null;
            if (this.mainWindow) {
              this.mainWindow.webContents.send('twitch-auth-interaction-required');
            }
          }
        }, 5000);
      }
    } catch (e) {
      console.error('Failed to load auth URL', e);
      if (this.authWindow) {
        this.authWindow.close();
        this.authWindow = null;
      }
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }
}