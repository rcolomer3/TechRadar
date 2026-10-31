import Parser from 'rss-parser';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';
import {madridDate,selectArticles,canonical,hash,validateCurated} from './core.mjs';
const dry=process.argv.includes('--dry-run'),now=new Date(),date=madridDate(now);
const sources=JSON.parse(await readFile(new URL('./sources.json',import.meta.url),'utf8'));
const curated=validateCurated(JSON.parse(await readFile(new URL('./curated.json',import.meta.url),'utf8')));
let db;
if(!dry){if(!process.env.FIREBASE_SERVICE_ACCOUNT)throw new Error('Missing FIREBASE_SERVICE_ACCOUNT GitHub secret. Use --dry-run locally.');initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))});db=getFirestore();}
// Editorial records are independent of whether today's feeds contain fresh stories.
if(db)for(const kind of ['updates','events'])for(const item of curated[kind])await db.collection(kind).doc(hash(item.url)).set(item);
const digestRef=db?.doc('digests/'+date);
const existing=digestRef?await digestRef.get():null;
// Resume sending after a publication failure without changing an already published digest.
let digest=existing?.exists?existing.data():null;
if(!digest){
 const parser=new Parser({timeout:15000,headers:{'User-Agent':'TechRadar/0.1 personal daily digest'}});
 const results=await Promise.allSettled(sources.map(async source=>{
  const feed=await parser.parseURL(source.url);
  return feed.items.flatMap(item=>{try{const url=canonical(item.link);if(!source.hosts.includes(new URL(url).hostname)||!item.title||!item.isoDate)return [];return [{title:item.title,url,source:source.name,publishedAt:new Date(item.isoDate).toISOString(),category:source.category,summary:item.contentSnippet||item.summary||item.title}];}catch{return [];}});
 }));
 const failed=results.flatMap((r,i)=>r.status==='rejected'?[sources[i].name]:[]);
 if(failed.length)console.warn('Unavailable sources:',failed.join(', '));
 if(failed.length===sources.length)throw new Error('All sources failed; no digest published.');
 const recent=db?await db.collection('digests').orderBy('date','desc').limit(7).get():null;
 const seen=recent?.docs.flatMap(d=>d.data().articles||[])||[];
 const articles=selectArticles(results.flatMap(r=>r.status==='fulfilled'?r.value:[]),seen,now);
 if(!articles.length){console.log('No new verified articles; nothing published.');process.exit(0);}
 digest={date,publishedAt:now.toISOString(),articles,status:'published',summaryMethod:'extractive-source-language',sourceFailures:failed,belowTarget:articles.length<5};
 if(digest.belowTarget)console.warn('Fewer than five verified items. Never padding with invented news.');
 if(dry){await mkdir('work',{recursive:true});await writeFile('work/digest-preview.json',JSON.stringify({digest,curated},null,2));console.log(`Dry run: ${articles.length} items. See work/digest-preview.json`);process.exit(0);}
 await digestRef.create(digest);
}
// Per-device delivery ledger. At-least-once after ambiguous network failures; notification tag collapses duplicates.
const tokens=await db.collectionGroup('tokens').limit(500).get();
for(const tokenDoc of tokens.docs){
 const delivery=db.doc(`deliveries/${date}-${hash(tokenDoc.ref.path)}`);
 if((await delivery.get()).exists)continue;
 try{await getMessaging().send({token:tokenDoc.data().token,data:{title:'Tu TechRadar está listo',body:`${digest.articles.length} noticias con fuentes. Tu pausa tecnológica de hoy.`,date},webpush:{headers:{TTL:'86400',Urgency:'normal'}}});await delivery.set({sentAt:FieldValue.serverTimestamp()});}
 catch(error){if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code))await tokenDoc.ref.delete();else throw error;}
}
console.log(`Published ${date}: ${digest.articles.length} articles; ${tokens.size} devices processed.`);
