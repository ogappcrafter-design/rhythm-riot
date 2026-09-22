import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const errs=[]; const p = await b.newPage({ viewport:{width:393,height:786}, deviceScaleFactor:2 });
p.on('pageerror',e=>errs.push('PE:'+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text());});
const O='/tmp/claude-0/-home-user-rhythm-riot/0b38e6c6-434a-5911-b136-96a10db1838f/scratchpad/store';
await p.goto(process.env.U,{waitUntil:'networkidle'});
await p.waitForTimeout(1300); await p.mouse.click(196,380);
await p.waitForSelector('.menu-logo',{timeout:5000});
await p.getByText('PLAY',{exact:false}).first().click();
await p.waitForSelector('.track-card',{timeout:5000});
// screenshot song select to check overlap fix
await p.waitForTimeout(400); await p.screenshot({path:O+'/check-songselect.png'});
await p.locator('.track-card').nth(1).locator('.diff-gem').nth(2).click(); // who moved the moon hard (has holds)
await p.waitForSelector('.lane-preview',{timeout:5000});
await p.getByText('START',{exact:false}).first().click();
await p.waitForSelector('.lane-controls',{timeout:9000});
await p.waitForTimeout(4000);
// press-hold a couple lanes to show active hold ribbons
for(let i=0;i<4;i++){const btn=p.locator('.lane-btn').nth(i);const bx=await btn.boundingBox();if(bx){await p.mouse.move(bx.x+bx.width/2,bx.y+bx.height/2);await p.mouse.down();}}
await p.waitForTimeout(500);
await p.screenshot({path:O+'/check-gameplay-holds.png'});
for(let i=0;i<4;i++){await p.mouse.up().catch(()=>{});}
await b.close();
console.log(errs.length?('ERRORS:\n'+errs.join('\n')):'NO ERRORS');
