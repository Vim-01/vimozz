import { AccessToken, RefreshingAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import axios from 'axios';

export interface RewardRedemption {
  id: string;
  userId: string;
  userName: string;
  rewardTitle: string;
  userInput: string;
  status: string;
}

export class EventSubService {
  private authProvider: RefreshingAuthProvider | null = null;
  private apiClient: ApiClient | null = null;
  private eventSubListener: EventSubWsListener | null = null;
  private onRewardRedemption: ((redemption: RewardRedemption) => void) | null = null;
  private userId: string | null = null;

  constructor() {
    console.log('EventSubService initialized');
  }

  async initialize(accessToken: string, refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
    try {
      console.log('Initializing EventSub with tokens...');

      this.authProvider = new RefreshingAuthProvider({
        clientId,
        clientSecret
      });

      const tokenData: AccessToken = {
        accessToken,
        refreshToken,
        scope: ['channel:read:redemptions', 'channel:manage:redemptions', 'user:read:email'],
        expiresIn: 14400,
        obtainmentTimestamp: Date.now()
      };

      await this.authProvider.addUserForToken(tokenData, ['chat', 'channel', 'user']);

      this.apiClient = new ApiClient({ authProvider: this.authProvider });

      // Получаем userId через запрос к Twitch API
      const response = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': clientId
        }
      });

      if (response.data.data && response.data.data.length > 0) {
        this.userId = response.data.data[0].id;
        console.log('Authenticated as:', response.data.data[0].login, 'ID:', this.userId);
      } else {
        throw new Error('Could not get user info from Twitch API');
      }

      // Создаём EventSub WebSocket listener
      this.eventSubListener = new EventSubWsListener({ apiClient: this.apiClient });
      this.eventSubListener.start();

      console.log('EventSub initialized successfully');
      
      return this.userId!;
    } catch (error) {
      console.error('Error initializing EventSub:', error);
      throw error;
    }
  }

  setRewardRedemptionCallback(callback: (redemption: RewardRedemption) => void): void {
    this.onRewardRedemption = callback;
  }

  async listenToChannelPoints(): Promise<void> {
    if (!this.eventSubListener || !this.userId) {
      throw new Error('EventSub listener or userId not initialized');
    }

    try {
      console.log('Listening to channel point redemptions for user:', this.userId);

      // Слушаем все выкупы наград канала
      this.eventSubListener.onChannelRedemptionAdd(this.userId, (redemption) => {
        console.log('Reward redeemed:', redemption.rewardTitle, 'by', redemption.userName);

        const redemptionData: RewardRedemption = {
          id: redemption.id,
          userId: redemption.userId,
          userName: redemption.userName,
          rewardTitle: redemption.rewardTitle,
          userInput: redemption.input,
          status: redemption.status
        };

        if (this.onRewardRedemption) {
          this.onRewardRedemption(redemptionData);
        }
      });

      console.log('Successfully listening to channel point redemptions');
    } catch (error) {
      console.error('Error listening to channel points:', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if (this.eventSubListener) {
      this.eventSubListener.stop();
      console.log('Stopped listening to channel points');
    }
  }

  getUserId(): string | null {
    return this.userId;
  }
}