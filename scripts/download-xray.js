const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

const XRAY_VERSION = '1.8.24'; // Or fetch latest
const platform = os.platform();
const arch = os.arch();

let assetName = '';
if (platform === 'linux' && arch === 'x64') {
  assetName = `Xray-linux-64.zip`;
} else if (platform === 'win32' && arch === 'x64') {
  assetName = `Xray-windows-64.zip`;
} else if (platform === 'darwin' && arch === 'arm64') {
  assetName = `Xray-macos-arm64-v8a.zip`;
} else if (platform === 'darwin' && arch === 'x64') {
  assetName = `Xray-macos-64.zip`;
} else {
  console.error(`Unsupported platform/arch: ${platform}/${arch}`);
  process.exit(1);
}

const url = `https://github.com/XTLS/Xray-core/releases/download/v${XRAY_VERSION}/${assetName}`;
const sidecarDir = path.join(__dirname, '..', 'sidecar', 'xray');
const zipPath = path.join(sidecarDir, assetName);

if (!fs.existsSync(sidecarDir)) {
  fs.mkdirSync(sidecarDir, { recursive: true });
}

// Check if binary already exists
const binName = platform === 'win32' ? 'xray.exe' : 'xray';
if (fs.existsSync(path.join(sidecarDir, binName))) {
  console.log('Xray binary already exists.');
  process.exit(0);
}

console.log(`Downloading Xray from ${url}...`);

const req = https.get(url, (res) => {
  if (res.statusCode === 301 || res.statusCode === 302) {
    // Handle redirect
    https.get(res.headers.location, (redirectRes) => {
      const fileStream = fs.createWriteStream(zipPath);
      redirectRes.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        extractAndCleanup();
      });
    }).on('error', (err) => {
      console.error('Download error:', err);
    });
  } else {
    const fileStream = fs.createWriteStream(zipPath);
    res.pipe(fileStream);
    fileStream.on('finish', () => {
      fileStream.close();
      extractAndCleanup();
    });
  }
}).on('error', (err) => {
  console.error('Download error:', err);
});

function extractAndCleanup() {
  console.log('Extracting...');
  try {
    if (platform === 'win32') {
      execSync(`powershell -command "Expand-Archive -Force '${zipPath}' '${sidecarDir}'"`);
    } else {
      execSync(`unzip -o "${zipPath}" -d "${sidecarDir}"`);
      execSync(`chmod +x "${path.join(sidecarDir, 'xray')}"`);
    }
    fs.unlinkSync(zipPath);
    console.log('Xray downloaded and extracted successfully.');
  } catch (error) {
    console.error('Extraction error:', error.message);
  }
}
