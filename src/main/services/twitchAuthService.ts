import axios from 'axios';
const { BrowserWindow } = require('electron');
export class TwitchAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private authWindow: any = null;
  private mainWindow: any = null;

  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID || '';
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
    this.redirectUri = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3001/callback';
  }

  setMainWindow(window: any): void {
    this.mainWindow = window;
  }

  async startAuth(): Promise<void> {
    if (!this.clientId) {
      throw new Error('Client ID is not configured');
    }

    const authUrl = `https://id.twitch.tv/oauth2/authorize` +
      `?client_id=${this.clientId}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&response_type=code` +
      `&scope=channel:read:subscriptions+user:read:email+channel:read:redemptions+channel:manage:redemptions`;

    this.authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await this.authWindow.loadURL(authUrl);
    this.authWindow.show();
  }

  handleCallback(code: string): void {
    this.exchangeCodeForToken(code);
  }

  private async exchangeCodeForToken(code: string): Promise<void> {
    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri
        }
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      if (this.authWindow) {
        this.authWindow.close();
        this.authWindow = null;
      }

      if (this.mainWindow) {
        this.mainWindow.webContents.send('twitch-auth-success', {
          accessToken: this.accessToken,
          refreshToken: this.refreshToken
        });
      }
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      
      const errorMessage = axios.isAxiosError(error) 
        ? error.response?.data?.message || error.message 
        : 'Unknown error';
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('twitch-auth-error', errorMessage);
      }
      
      if (this.authWindow) {
        this.authWindow.close();
        this.authWindow = null;
      }
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }
}