import {createHash} from 'node:crypto';
export const madridDate=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const hash=s=>createHash('sha256').update(s).digest('hex');
export function canonical(raw){const u=new URL(raw);if(u.protocol!=='https:')throw new Error('HTTPS required');u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(key))u.searchParams.delete(key);u.searchParams.sort();u.pathname=u.pathname.replace(/\/$/,'')||'/';return u.href;}
export const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
export function excerpt(s){const text=plain(s);if(text.length<=230)return text;return text.slice(0,227).replace(/\s+\S*$/,'')+'…';}
export const titleKey=s=>plain(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function selectArticles(items,seen=[],now=new Date()){
 const urls=new Set(seen.map(a=>canonical(a.url))),titles=new Set(seen.map(a=>titleKey(a.title)));
 return items.filter(a=>{const age=now-new Date(a.publishedAt);return Number.isFinite(age)&&age>=0&&age<=48*3600000;}).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).filter(a=>{let url;try{url=canonical(a.url);}catch{return false;}const title=titleKey(a.title);if(!title||urls.has(url)||titles.has(title))return false;urls.add(url);titles.add(title);return true;}).slice(0,8).map(a=>({...a,id:hash(canonical(a.url)),url:canonical(a.url),title:plain(a.title),summary:excerpt(a.summary)}));
}
export function validateCurated(data){
 const hosts={iOS:['support.apple.com','www.apple.com','developer.apple.com'],macOS:['support.apple.com','www.apple.com','developer.apple.com'],Windows:['support.microsoft.com','blogs.windows.com','learn.microsoft.com'],Synology:['www.synology.com','kb.synology.com']};
 for(const u of data.updates){if(!hosts[u.platform]?.includes(new URL(u.url).hostname)||!/^\d{4}-\d{2}-\d{2}T/.test(u.publishedAt)||!u.title||!u.summary)throw new Error('Invalid curated update');canonical(u.url);}
 for(const e of data.events){if(e.confirmed!==true||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!e.title||!e.summary||!e.officialHost||new URL(e.url).hostname!==e.officialHost)throw new Error('Invalid confirmed event');canonical(e.url);}
 return data;
}
