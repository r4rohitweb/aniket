import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const baseUrl = 'http://localhost/testing/aniket-prof/';
await mkdir('.qa', { recursive: true });
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9225', '--remote-allow-origins=*',
  '--user-data-dir=' + path.resolve('.qa/chrome'), 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let tabs;
  for (let i = 0; i < 40; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9225/json')).json(); break; }
    catch { await pause(250); }
  }
  if (!tabs) throw Error('Chrome debugging endpoint unavailable');
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map(), errors = [], failed = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) callback?.reject(Error(message.error.message));
      else callback?.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400)
      failed.push(message.params.response.url);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: baseUrl });
  await pause(7000);
  const desktop = await evaluate(`({title:document.title,ready:document.readyState,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector('h1')?.innerText,bodyClass:document.body.className})`);
  if (!desktop.bodyClass.includes('ready')) throw Error('Homepage did not initialize: ' + JSON.stringify({desktop, errors, failed}));
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('.qa/desktop.png', Buffer.from(shot.data, 'base64'));
  await evaluate(`document.querySelector('#works').scrollIntoView({behavior:'instant'})`);
  await pause(1800);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('.qa/doors.png', Buffer.from(shot.data, 'base64'));
  await evaluate(`document.querySelector('.doorway').click()`);
  await pause(3400);
  const door = await evaluate(`({path:location.pathname,entered:document.querySelector('.wallv')?.classList.contains('live')})`);
  await evaluate(`history.back()`);
  await pause(2800);
  await evaluate(`document.querySelector('#cordHit').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  await pause(700);
  const theme = await evaluate(`document.documentElement.dataset.mode`);
  await evaluate(`document.querySelector('#cordHit').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));document.querySelector('[data-contact]').click()`);
  await pause(600);
  const contact = await evaluate(`!document.querySelector('#modal').hidden`);
  await evaluate(`document.querySelector('#mClose').click();document.querySelector('#about').scrollIntoView({behavior:'instant'})`);
  await pause(1000);
  const story = await evaluate(`({chapter:document.querySelector('.story').dataset.ch,active:document.querySelectorAll('.ch.on').length})`);
  const removedFeatures = await evaluate(`({cardButtons:document.querySelectorAll('#holoOpen,#holo').length})`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: baseUrl });
  await pause(5000);
  const mobile = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector('h1')?.innerText})`);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('.qa/mobile.png', Buffer.from(shot.data, 'base64'));
  await evaluate(`document.querySelector('#menuBtn').click()`);
  await pause(600);
  const menu = await evaluate(`({hidden:document.querySelector('#navm').hidden,classes:document.querySelector('#navm').className})`);
  const rooms = [];
  for (const route of ['seo-content','website-copy','social-ad-copy','email-scripts','creative-writing']) {
    await send('Page.navigate', { url: baseUrl + route + '/' });
    await pause(1800);
    rooms.push(await evaluate(`({path:location.pathname,title:document.title,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector('h1')?.innerText,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)})`));
  }
  const report = { desktop, door, theme, contact, story, removedFeatures, mobile, menu, rooms, errors, failed: [...new Set(failed)] };
  await writeFile('.qa/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await send('Browser.close');
} finally {
  socket?.close();
  browser.kill();
}
