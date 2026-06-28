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
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><head><meta charset="utf-8"><title>Авторизация Twitch</title></head><body style="font-family: sans-serif; text-align: center; padding-top: 50px;"><h1>Успешная авторизация!</h1><p>Можете закрыть это окно и вернуться в приложение.</p></body></html>');
        } else {
          res.writeHead(400);
          res.end('Authorization failed');
        }
      } else if (req.url?.startsWith('/proxy.pac')) {
        const url = new URL(req.url, `http://localhost:3001`);
        const port = url.searchParams.get('port') || '10808';
        res.writeHead(200, { 'Content-Type': 'application/x-ns-proxy-autoconfig' });
        res.end(`
          function FindProxyForURL(url, host) {
            if (shExpMatch(host, "*.youtube.com") || 
                shExpMatch(host, "*.googlevideo.com") || 
                shExpMatch(host, "youtu.be")) {
              return "SOCKS5 127.0.0.1:${port}";
            }
            return "DIRECT";
          }
        `);
      } else {
        res.writeHead(404);
        res.end('Not found');
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