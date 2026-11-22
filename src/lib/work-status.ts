export function workStatus(point:{passedAt:Date|null;due:Date;workStatus:string},now=new Date()) {
  if(point.passedAt) return "Выполнено";
  if(point.workStatus==="SUBMITTED") return "Отправлено на проверку";
  if(point.workStatus==="REVISION") return "На доработке";
  if(point.due<now) return "Просрочено";
  return point.workStatus==="IN_PROGRESS"?"В процессе":"Не начато";
}
