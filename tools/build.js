// 把交接站 index.html（含 img/）打包成單檔，再用 AES-GCM 加密成密碼門頁面
// 用法：node tools/build.js <來源資料夾> <輸出 index.html>   密碼從環境變數 HANDOFF_PW 讀
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [src, out] = process.argv.slice(2);
const pw = process.env.HANDOFF_PW; if (!pw) { console.error('缺 HANDOFF_PW'); process.exit(1); }
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const imgDir = path.join(src, 'img'); const IMG = {};
for (const f of fs.readdirSync(imgDir)) IMG[f.replace(/\.jpg$/, '')] = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(imgDir, f)).toString('base64');
html = html.replace('img/${m.img}.jpg', '${IMG[m.img]}').replace('img/tex_${t[0]}.jpg', '${IMG["tex_"+t[0]]}');
html = html.replace(/img\/([A-Za-z0-9_]+)\.jpg/g, (_, n) => { if (!IMG[n]) throw new Error('缺圖 ' + n); return IMG[n]; });
html = html.replace('<script>', '<script>const IMG=' + JSON.stringify(IMG) + ';\n');
if (/img\//.test(html.replace(/data:image[^"]*/g, ''))) console.warn('還有 img/ 參照沒換掉');
const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(pw, salt, 600000, 32, 'sha256');
const c = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([c.update(html, 'utf8'), c.final(), c.getAuthTag()]);
const payload = { s: salt.toString('base64'), i: iv.toString('base64'), d: ct.toString('base64') };
const gate = fs.readFileSync(path.join(__dirname, 'gate.html'), 'utf8').replace('__PAYLOAD__', JSON.stringify(payload));
fs.writeFileSync(out, gate);
console.log('ok', (gate.length / 1024).toFixed(0) + ' KB', Object.keys(IMG).length + ' 張圖');
