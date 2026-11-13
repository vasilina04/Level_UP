import { requireStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { achievementMetrics } from "@/lib/progress";
import { achievementDefinitions, percent } from "@/lib/rules";
import { dateLabel } from "@/lib/dates";
import { BadgeIcon, Progress, SectionTitle, StatusPill } from "@/components/common";
export default async function Achievements() {
  const {id}=await requireStudent();
  const [earned,metrics]=await Promise.all([db.studentAchievement.findMany({where:{studentId:id},include:{achievement:true}}),achievementMetrics(db,id)]);
  const byCode=new Map(earned.map(e=>[e.achievement.code,e.earnedAt]));
  return <><SectionTitle title="Достижения" subtitle={"Открыто "+earned.length+" из "+achievementDefinitions.length}/><div className="badge-grid">{achievementDefinitions.map(a=>{
    const date=byCode.get(a.code),done=Math.min(metrics[a.code],a.goal);
    return <article className={"card achievement"+(date?" earned":"")} key={a.code}><div className="quest-top"><BadgeIcon icon={a.icon} color={date?a.color:"neutral"}/><StatusPill label={a.rarity} color={a.color}/></div><h2>{a.name}</h2><p>{a.description}</p>{date?<p className="text-mint">Получено {dateLabel(date)}</p>:<><Progress value={percent(done,a.goal)} label={a.name}/><small>{done} / {a.goal}</small></>}</article>;
  })}</div></>;
}
