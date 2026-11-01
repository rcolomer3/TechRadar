// ChatGPT researches and writes editions/*.json. This publisher never generates news.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {madridDate,hash,validateCurated} from './core.mjs';
import {validateEdition,rejectRepeats,editionHash,deliverOnce} from './edition.mjs';

const now=new Date(),today=madridDate(now),date=process.env.RADAR_DATE||today;
const dry=process.argv.includes('--dry-run'),archive=process.env.RADAR_ARCHIVE==='true';
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Fecha no válida.');
const report={date,mode:dry?'validation':archive?'archive':'publication'};
await mkdir('work',{recursive:true});
try{
 let input;try{input=JSON.parse(await readFile(new URL(`../editions/${date}.json`,import.meta.url),'utf8'));}
 catch(error){if(error.code==='ENOENT')throw new Error('ChatGPT todavía no ha entregado una edición para '+date+'. No se publican extractos RSS ni se envían avisos.');throw error;}
 const edition=validateEdition(input,date),contentHash=editionHash(edition);
 report.articles=edition.articles.length;
 if(date>today||date<today&&!archive)throw new Error('Una edición histórica requiere el modo de archivo; no se puede publicar una fecha futura.');
 if(dry){report.status='validated';console.log('Edición validada:',date,edition.articles.length,'noticias completas en español.');}
 else{
  if(!process.env.FIREBASE_SERVICE_ACCOUNT)throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT.');
  const [{initializeApp,cert},{getFirestore},{getMessaging}]=await Promise.all([import('firebase-admin/app'),import('firebase-admin/firestore'),import('firebase-admin/messaging')]);
  initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))});const db=getFirestore(),ref=db.doc('digests/'+date);
  const recent=await db.collection('digests').orderBy('date','desc').limit(14).get();
  rejectRepeats(edition.articles,recent.docs.filter(d=>d.id!==date).flatMap(d=>d.data().articles||[]));
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'2-digit',hourCycle:'h23'}).format(now));
  if(date===today&&hour<19){
   await db.doc('drafts/'+date).set({...edition,contentHash,status:'ready',preparedAt:now.toISOString()});report.status='ready';
   console.log('Edición validada y preparada para las 19:00 de Madrid. Sin publicación ni avisos anticipados.');
  }else{
   const digest={...edition,contentHash,status:'published',publishedAt:now.toISOString()};
   await db.runTransaction(async tx=>{
    const existing=await tx.get(ref);
    if(existing.exists){
     if(existing.data().contentHash===contentHash)return;
     if(existing.data().editorialVersion===2)throw new Error('La edición ya publicada es inmutable. No se sobrescribe ni reenvía.');
     // Keep legacy excerpts intact as a revision when correcting the former format.
     tx.set(db.doc('digestRevisions/'+date+'-legacy'),existing.data());
    }
    tx.set(ref,digest);
   });
   report.status='published';report.notifications={accepted:0,skipped:0,invalid:0,uncertain:0};
   if(!archive){
    const tokens=await db.collectionGroup('tokens').limit(501).get();
    if(tokens.size>500)throw new Error('Más de 500 dispositivos: se requiere paginación antes de notificar.');
    const messaging=getMessaging();
    for(const tokenDoc of tokens.docs){const result=await deliverOnce({db,messaging,tokenDoc,date,articles:edition.articles.length});report.notifications[result]++;}
    if(report.notifications.uncertain)throw new Error('Resultado incierto de un envío; no se reintenta automáticamente para evitar duplicados.');
   }
   console.log('Edición publicada:',date,edition.articles.length,'noticias. Avisos aceptados:',report.notifications.accepted);
  }
  const curated=validateCurated(JSON.parse(await readFile(new URL('./curated.json',import.meta.url),'utf8')));
  for(const kind of ['updates','events'])for(const item of curated[kind])await db.collection(kind).doc(hash(item.url)).set(item);
 }
}catch(error){report.status='failed';report.error=error.message;console.error(error.message);process.exitCode=1;}
finally{await writeFile('work/publication-report.json',JSON.stringify(report,null,2));}
