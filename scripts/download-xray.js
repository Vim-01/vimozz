const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  const xrayDir = path.join(__dirname, '..', 'sidecar', 'xray');
  if (!fs.existsSync(xrayDir)) {
    fs.mkdirSync(xrayDir, { recursive: true });
  }

  const linuxUrl = `https://github.com/XTLS/Xray-core/releases/download/v26.6.27/Xray-linux-64.zip`;
  const winUrl = `https://github.com/XTLS/Xray-core/releases/download/v26.6.27/Xray-windows-64.zip`;

  const linuxZip = path.join(xrayDir, 'xray-linux.zip');
  const winZip = path.join(xrayDir, 'xray-windows.zip');

  console.log('Downloading Xray for Linux...');
  await downloadFile(linuxUrl, linuxZip);
  execSync(`unzip -o ${linuxZip} xray -d ${xrayDir}`);
  fs.unlinkSync(linuxZip);

  console.log('Downloading Xray for Windows...');
  await downloadFile(winUrl, winZip);
  execSync(`unzip -o ${winZip} xray.exe -d ${xrayDir}`);
  fs.unlinkSync(winZip);

  console.log('Xray binaries downloaded successfully.');
}

main().catch(console.error);
