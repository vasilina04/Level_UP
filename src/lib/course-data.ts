import { z } from "zod";
import { dateLabel } from "./dates";
import { applyRule } from "./course-ui-data";
export { activityKinds,applyRule,courseGrade } from "./course-ui-data";
const uuid=z.string().uuid();
export const activitySchema=z.object({
  id:uuid,title:z.string().trim().min(2).max(120),
  kind:z.enum(["LAB","CONTROL","TEST","PRACTICE","PROJECT","CREDIT","EXAM","EXTRA"]),
  startsAt:z.string().datetime(), place:z.string().trim().min(1).max(160),
  format:z.enum(["Очно","Онлайн"]), description:z.string().trim().min(1).max(1000),
  topics:z.string().trim().min(1).max(1000), requirements:z.string().trim().min(1).max(1000),
  max:z.coerce.number().int().min(1).max(1000), weight:z.coerce.number().int().min(1).max(100),
  optional:z.boolean(), registration:z.boolean().default(false),
  materials:z.union([z.literal(""),z.string().url().refine(value=>/^https?:\/\//i.test(value))]),
  checkpointTitle:z.string().max(160).optional(), examId:uuid.optional(),
});
const ruleSchema=z.object({
  cap:z.coerce.number().int().min(1).max(10000),
  bonus:z.coerce.number().int().min(0).max(10000),
  rounding:z.enum(["NONE","FLOOR","NEAREST"]),
  pass:z.coerce.number().int().min(0), good:z.coerce.number().int().min(0), excellent:z.coerce.number().int().min(0),
}).refine(value=>value.pass<value.good&&value.good<value.excellent&&value.excellent<=value.cap&&value.bonus<=value.cap,
  "Укажите возрастающие пороги в пределах максимального балла.");
export const planSchema=z.object({
  title:z.string().trim().min(2).max(120),period:z.string().trim().min(2).max(120),
  rule:ruleSchema.nullable(),activities:z.array(activitySchema).max(60),
}).refine(value=>new Set(value.activities.map(a=>a.id)).size===value.activities.length);
export type Activity=z.infer<typeof activitySchema>;
export type Plan=z.infer<typeof planSchema>;
export type Rule=NonNullable<Plan["rule"]>;
export const emptyPlan=(title:string):Plan=>({title,period:"",rule:null,activities:[]});
export function parsePlan(value:unknown) {
  const parsed=planSchema.safeParse(value);
  return parsed.success?parsed.data:null;
}
export type ResultRow={activityId:string,points:number|null,status:string};
export function ratingFor(plan:Plan,results:ResultRow[]) {
  const byId=new Map(results.map(result=>[result.activityId,result]));
  const rows=plan.activities.map(activity=>({...activity,result:byId.get(activity.id)}));
  const earned=rows.reduce((sum,row)=>sum+(row.result?.points??0)*row.weight,0);
  const bonusEarned=rows.filter(row=>row.optional).reduce((sum,row)=>sum+(row.result?.points??0)*row.weight,0);
  const remaining=rows.filter(row=>!row.result||row.result.status==="WAITING");
  const remainingBonus=remaining.filter(row=>row.optional).reduce((sum,row)=>sum+row.max*row.weight,0);
  const remainingRegular=remaining.filter(row=>!row.optional).reduce((sum,row)=>sum+row.max*row.weight,0);
  const rule=plan.rule;
  const current=earned-bonusEarned+(rule?Math.min(rule.bonus,bonusEarned):bonusEarned);
  const potential=remainingRegular+(rule?Math.min(Math.max(0,rule.bonus-bonusEarned),remainingBonus):remainingBonus);
  return {rows,remaining,earned:current,potential,score:rule?applyRule(rule,current):null,
    maximum:rule?applyRule(rule,current+potential):null,bonusEarned};
}
const labels:Record<keyof Activity,string>={id:"Идентификатор",title:"Название",kind:"Тип",startsAt:"Дата и время",place:"Место",format:"Формат",description:"Описание",topics:"Темы",requirements:"Требования",max:"Максимум баллов",weight:"Вес",optional:"Дополнительное",registration:"Регистрация",materials:"Материалы",checkpointTitle:"Связь с контрольной точкой",examId:"Связь с сессией"};
export function planDiff(before:Plan|null,current:Plan) {
  if(!before) return ["Первая публикация · "+current.activities.length+" мероприятий"];
  const changes:string[]=[];
  if(before.title!==current.title) changes.push("Название: "+before.title+" → "+current.title);
  if(before.period!==current.period) changes.push("Период: "+before.period+" → "+current.period);
  if(JSON.stringify(before.rule)!==JSON.stringify(current.rule)) {
    const describe=(rule:Rule|null)=>rule?`максимум ${rule.cap}, бонус до ${rule.bonus}, пороги ${rule.pass}/${rule.good}/${rule.excellent}, округление ${roundingLabels[rule.rounding]}`:"правила отсутствуют";
    changes.push("Правила: "+describe(before.rule)+" → "+describe(current.rule));
  }
  const old=new Map(before.activities.map(activity=>[activity.id,activity]));
  for(const activity of current.activities){
    const previous=old.get(activity.id);
    if(!previous){changes.push("Добавлено: "+activity.title);continue;}
    old.delete(activity.id);
    for(const key of Object.keys(labels) as (keyof Activity)[]){
      if(previous[key]===activity[key]) continue;
      const format=(item:Activity)=>key==="startsAt"?dateLabel(new Date(item.startsAt),{dateStyle:"short",timeStyle:"short"}):String(item[key]??"—");
      changes.push(activity.title+" · "+labels[key]+": "+format(previous)+" → "+format(activity));
    }
  }
  for(const item of old.values()) changes.push("Удалено: "+item.title);
  return changes;
}
export const roundingLabels={NONE:"до сотых",FLOOR:"вниз до целого",NEAREST:"до ближайшего целого"} as const;
export function activityStatus(activity:Activity,result:ResultRow|undefined,previous?:Activity,confirmed=false) {
  if(result?.status==="GRADED") return "Оценено";
  if(result?.status==="MISSED") return "Пропущено";
  if(result?.status==="WAITING"||confirmed) return "Завершено, ожидается результат";
  if(previous&&previous.startsAt!==activity.startsAt) return "Перенесено";
  const hours=(+new Date(activity.startsAt)-Date.now())/3_600_000;
  return hours<=0?"Завершено, ожидается результат":hours<=168?"Открыта подготовка":"Предстоит";
}
