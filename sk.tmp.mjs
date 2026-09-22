import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({ viewport:{width:393,height:786}, deviceScaleFactor:2 });
const O='/tmp/claude-0/-home-user-rhythm-riot/0b38e6c6-434a-5911-b136-96a10db1838f/scratchpad/store';
await p.goto('http://localhost:4188/',{waitUntil:'networkidle'});
await p.waitForTimeout(1300); await p.mouse.click(196,380);
await p.waitForSelector('.menu-logo',{timeout:5000});
await p.getByText('PLAY',{exact:false}).first().click();
await p.waitForSelector('.track-card',{timeout:5000});
await p.locator('.track-card').first().locator('.diff-gem').first().click();
await p.waitForSelector('.lane-preview',{timeout:5000});
await p.getByText('START',{exact:false}).first().click();
await p.waitForTimeout(700); // during the ARE YOU READY moment
await p.screenshot({path:O+'/check-ready.png'});
await b.close(); console.log('OK');
