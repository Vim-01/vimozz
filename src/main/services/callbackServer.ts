import * as http from 'http';
import { TwitchAuthService } from './twitchAuthService';

export class CallbackServer {
  private server: http.Server;
  private authService: TwitchAuthService;

  constructor(authService: TwitchAuthService) {
    this.authService = authService;
    
    this.server = http.createServer((req, res) => {
      if (req.url?.startsWith('/callback')) {
        const url = new URL(req.url, `http://localhost:3001`);
        const code = url.searchParams.get('code');
        
        if (code) {
          this.authService.handleCallback(code);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Успешная авторизация!</h1><p>Можете закрыть это окно</p></body></html>');
        } else {
          res.writeHead(400);
          res.end('Authorization failed');
        }
      }
    });

    this.server.listen(3001, () => {
      console.log('Callback server listening on port 3001');
    });
  }

  close() {
    this.server.close();
  }
}