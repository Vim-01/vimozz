import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
const { app } = require('electron');

export class BypassService {
    private xrayProcess: ChildProcess | null = null;
    private configPath: string;
    private xrayExecutable: string;

    constructor() {
        const isWindows = process.platform === 'win32';
        let basePath = path.join(__dirname, '..', '..', '..', 'sidecar');
        if (!fs.existsSync(basePath) && (process as any).resourcesPath) {
            basePath = path.join((process as any).resourcesPath, 'sidecar');
        }
        this.xrayExecutable = path.join(basePath, 'xray', isWindows ? 'xray.exe' : 'xray');
        
        // We will store the generated config in user data folder
        this.configPath = path.join(app.getPath('userData'), 'xray_config.json');
    }

    public async startVless(vlessUrl: string): Promise<number> {
        this.stop();
        
        try {
            const config = this.parseVlessUrlToXrayConfig(vlessUrl);
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            
            this.xrayProcess = spawn(this.xrayExecutable, ['run', '-c', this.configPath]);

            this.xrayProcess.stdout?.on('data', (data) => {
                console.log(`Xray stdout: ${data}`);
            });

            this.xrayProcess.stderr?.on('data', (data) => {
                console.error(`Xray stderr: ${data}`);
            });

            this.xrayProcess.on('error', (err) => {
                console.error('Failed to start Xray:', err);
            });

            this.xrayProcess.on('close', (code) => {
                console.log(`Xray process exited with code ${code}`);
                this.xrayProcess = null;
            });

            return 10808; // The local SOCKS5 port we configured
        } catch (error) {
            console.error('Error starting VLESS:', error);
            throw error;
        }
    }

    public stop() {
        if (this.xrayProcess) {
            this.xrayProcess.kill();
            this.xrayProcess = null;
        }
    }

    private parseVlessUrlToXrayConfig(urlStr: string): any {
        const url = new URL(urlStr);
        if (url.protocol !== 'vless:') {
            throw new Error('Not a vless URL');
        }

        const uuid = url.username;
        const address = url.hostname;
        const port = parseInt(url.port);
        const params = url.searchParams;

        const security = params.get('security') || 'none';
        const sni = params.get('sni') || address;
        const fp = params.get('fp') || 'chrome';
        const type = params.get('type') || 'tcp';
        const pbk = params.get('pbk') || '';
        const flow = params.get('flow') || '';

        const outbound: any = {
            protocol: 'vless',
            settings: {
                vnext: [{
                    address,
                    port,
                    users: [{
                        id: uuid,
                        encryption: "none",
                        ...(flow ? { flow } : {})
                    }]
                }]
            },
            streamSettings: {
                network: type,
                security: security
            }
        };

        if (security === 'tls') {
            outbound.streamSettings.tlsSettings = {
                serverName: sni,
                fingerprint: fp
            };
        } else if (security === 'reality') {
            outbound.streamSettings.realitySettings = {
                serverName: sni,
                fingerprint: fp,
                publicKey: pbk,
                shortId: params.get('sid') || '',
                spiderX: params.get('spx') || '/'
            };
        }

        if (type === 'ws') {
            outbound.streamSettings.wsSettings = {
                path: params.get('path') || '/',
                headers: {
                    Host: params.get('host') || sni
                }
            };
        } else if (type === 'grpc') {
            outbound.streamSettings.grpcSettings = {
                serviceName: params.get('serviceName') || '',
                multiMode: params.get('mode') === 'multi'
            };
        } else if (type === 'xhttp') {
            let parsedHost = params.get('host');
            outbound.streamSettings.xhttpSettings = {
                path: params.get('path') || '/',
                host: parsedHost || sni
            };
            if (params.has('mode')) {
                outbound.streamSettings.xhttpSettings.mode = params.get('mode');
            }
            if (params.has('extra')) {
                try {
                    const extraData = JSON.parse(params.get('extra')!);
                    // Merge extra properties directly into xhttpSettings as required by newer Xray schemas
                    Object.assign(outbound.streamSettings.xhttpSettings, extraData);
                } catch (e) {
                    console.error('Failed to parse xhttp extra', e);
                }
            }
        }

        return {
            log: { loglevel: 'warning' },
            inbounds: [{
                port: 10808,
                listen: "127.0.0.1",
                protocol: "socks",
                settings: { udp: true }
            }, {
                port: 10809,
                listen: "127.0.0.1",
                protocol: "http",
                settings: {}
            }],
            outbounds: [
                outbound,
                { protocol: "freedom", tag: "direct" }
            ]
        };
    }
}
