import { addDays, calendarLabel, dayKey, weekOf } from "./dates";
import { weightedMean } from "./weights";
export type GradeEntry={id:string,assessedAt:Date,title:string,subject:string,value:number,points:number,maxPoints:number,weight:number};
export function gradeTrend(entries:GradeEntry[]) {
  const weeks=new Map<string,(Omit<GradeEntry,"assessedAt">&{date:string})[]>();
  const label=(day:string)=>calendarLabel(day,{day:"numeric",month:"short"});
  for(const {assessedAt,...grade} of [...entries].sort((a,b)=>+a.assessedAt-+b.assessedAt)){
    const day=dayKey(assessedAt),start=weekOf(day);
    const rows=weeks.get(start)??[];
    rows.push({...grade,date:label(day)});
    weeks.set(start,rows);
  }
  const starts=[...weeks.keys()];
  if(!starts.length) return [];
  const result=[];
  for(let week=starts[0];week<=starts.at(-1)!;week=addDays(week,7)){
    const grades=weeks.get(week)??[];
    result.push({week,label:label(week),period:label(week)+" – "+label(addDays(week,6)),
      average:weightedMean(grades),grades});
  }
  return result;
}
export type GradeWeek=ReturnType<typeof gradeTrend>[number];
