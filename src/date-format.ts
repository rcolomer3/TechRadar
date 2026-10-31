/** Calendar dates keep their announced day; timestamps use Madrid local time. */
export function formatDateES(value:string):string{
 const calendar=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 if(calendar)return `${calendar[3]}/${calendar[2]}/${calendar[1]}`;
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return 'Fecha no disponible';
 return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Madrid'}).format(date);
}
