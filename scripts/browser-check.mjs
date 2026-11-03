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
  await evaluate(`document.querySelector('.nav [data-go="tools"]').click()`);
  await pause(2000);
  const tools = await evaluate(`({path:location.pathname,groups:document.querySelectorAll('#tools .tool-group').length,count:document.querySelectorAll('#tools .tool-item').length,width:innerWidth,scrollWidth:document.documentElement.scrollWidth})`);
  if (tools.path !== '/testing/aniket-prof/tools' || tools.count !== 17 || tools.groups !== 4 || tools.scrollWidth > tools.width) throw Error('Tools section failed: ' + JSON.stringify(tools));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('.qa/tools-desktop.png', Buffer.from(shot.data, 'base64'));
  await evaluate(`document.querySelector('.nav [data-go="certificates"]').click()`);
  await pause(2000);
  const certificates = await evaluate(`({path:location.pathname,count:document.querySelectorAll('#certificates .credential').length,links:[...document.querySelectorAll('#certificates .credential')].map(a=>({url:a.href,label:a.getAttribute('aria-label'),target:a.target})),inProgress:document.querySelector('.learning-note__status')?.textContent,top:document.querySelector('#certificates').getBoundingClientRect().top,width:innerWidth,scrollWidth:document.documentElement.scrollWidth})`);
  if (certificates.count !== 3 || certificates.path !== '/testing/aniket-prof/certificates') throw Error('Certificate section navigation failed: ' + JSON.stringify(certificates));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('.qa/certificates-desktop.png', Buffer.from(shot.data, 'base64'));
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
  await evaluate(`window.__lenis ? window.__lenis.scrollTo(document.querySelector('#tools'),{immediate:true}) : document.querySelector('#tools').scrollIntoView({behavior:'instant'})`);
  await pause(300);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('.qa/tools-dark.png', Buffer.from(shot.data, 'base64'));
  await evaluate(`window.__lenis ? window.__lenis.scrollTo(document.querySelector('#certificates'),{immediate:true}) : document.querySelector('#certificates').scrollIntoView({behavior:'instant'})`);
  await pause(300);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('.qa/certificates-dark.png', Buffer.from(shot.data, 'base64'));
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
  await evaluate(`[...document.querySelectorAll('#navList .navm__item')].find(b=>b.textContent.includes('Tools')).click()`);
  await pause(2200);
  const mobileTools = await evaluate(`({path:location.pathname,count:document.querySelectorAll('#tools .tool-item').length,width:innerWidth,scrollWidth:document.documentElement.scrollWidth})`);
  if (mobileTools.path !== '/testing/aniket-prof/tools' || mobileTools.count !== 17 || mobileTools.scrollWidth > mobileTools.width) throw Error('Mobile tools section failed: ' + JSON.stringify(mobileTools));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('.qa/tools-mobile.png', Buffer.from(shot.data, 'base64'));
  await evaluate(`document.querySelector('#menuBtn').click()`);
  await pause(600);
  await evaluate(`[...document.querySelectorAll('#navList .navm__item')].find(b=>b.textContent.includes('Certificates')).click()`);
  await pause(2200);
  const mobileCertificates = await evaluate(`({path:location.pathname,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,top:document.querySelector('#certificates').getBoundingClientRect().top,count:document.querySelectorAll('#certificates .credential').length})`);
  if (mobileCertificates.path !== '/testing/aniket-prof/certificates' || mobileCertificates.scrollWidth > mobileCertificates.width) throw Error('Mobile certificate navigation or layout failed: ' + JSON.stringify(mobileCertificates));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('.qa/certificates-mobile.png', Buffer.from(shot.data, 'base64'));
  const rooms = [];
  for (const route of ['seo-content','website-copy','social-ad-copy','email-scripts','creative-writing']) {
    await send('Page.navigate', { url: baseUrl + route + '/' });
    await pause(1800);
    rooms.push(await evaluate(`({path:location.pathname,title:document.title,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector('h1')?.innerText,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)})`));
  }
  await send('Page.navigate', { url: baseUrl + 'certificates/' });
  await pause(5000);
  const certificateDirectRoute = await evaluate(`({path:location.pathname,base:document.baseURI,top:document.querySelector('#certificates').getBoundingClientRect().top,viewportHeight:innerHeight,loaded:document.body.classList.contains('ready')})`);
  if (!certificateDirectRoute.loaded || certificateDirectRoute.top < -1 || certificateDirectRoute.top > certificateDirectRoute.viewportHeight / 3) throw Error('Direct certificate route did not restore section: ' + JSON.stringify(certificateDirectRoute));
  await send('Page.navigate', { url: baseUrl + 'tools/' });
  await pause(5000);
  const toolsDirectRoute = await evaluate(`({path:location.pathname,base:document.baseURI,top:document.querySelector('#tools').getBoundingClientRect().top,viewportHeight:innerHeight,loaded:document.body.classList.contains('ready')})`);
  if (!toolsDirectRoute.loaded || Math.abs(toolsDirectRoute.top) > toolsDirectRoute.viewportHeight / 3) throw Error('Direct tools route failed: ' + JSON.stringify(toolsDirectRoute));
  const report = { desktop, tools, mobileTools, toolsDirectRoute, certificates, certificateDirectRoute, door, theme, contact, story, removedFeatures, mobile, menu, mobileCertificates, rooms, errors, failed: [...new Set(failed)] };
  await writeFile('.qa/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await send('Browser.close');
  if (errors.length || failed.length) throw Error('Browser reported failed requests or script errors; see .qa/report.json');
} finally {
  socket?.close();
  browser.kill();
}
