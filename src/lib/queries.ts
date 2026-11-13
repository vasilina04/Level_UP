import { db } from "@/lib/db";
import { dayKey, addDays } from "@/lib/dates";
import { levelFor } from "@/lib/rules";
import { checkpointProgress, weightedMean } from "@/lib/weights";

export const questsFor = (studentId:string) => db.quest.findMany({where:{studentId},orderBy:{due:"asc"},include:{completion:true,enrollment:{include:{subject:true}}}});
export const gradesFor = (studentId:string) => db.enrollment.findMany({where:{studentId},include:{subject:true,grades:{orderBy:{assessedAt:"asc"}},assessments:{orderBy:{due:"asc"}},exams:{orderBy:{start:"asc"}}},orderBy:{subject:{title:"asc"}}});
export async function statsFor(studentId:string) {
  const [xp,points] = await Promise.all([
    db.xpEvent.aggregate({where:{studentId},_sum:{amount:true}}),
    db.assessment.findMany({where:{enrollment:{studentId}},select:{title:true,due:true,weight:true,passedAt:true},orderBy:{due:"asc"}}),
  ]);
  return {xp:levelFor(xp._sum.amount??0),...checkpointProgress(points),closest:points.find(point=>!point.passedAt)};
}
export const stagesFor = (studentId:string) => db.semesterStage.findMany({where:{assessments:{some:{enrollment:{studentId}}}},orderBy:{position:"asc"},include:{
  assessments:{where:{enrollment:{studentId}},orderBy:{due:"asc"},include:{enrollment:{include:{subject:true}}}},
  progress:{where:{studentId}},
}});
export const recentBadges=(studentId:string) => db.studentAchievement.findMany({where:{studentId},take:3,orderBy:[{earnedAt:"desc"},{achievementId:"asc"}],include:{achievement:true}});
export async function refreshInbox(userId:string,groupId:string,reminders:boolean) {
  const now=new Date();
  const [announcements,deadlines]=await Promise.all([
    db.announcement.findMany({where:{groupId,publishedAt:{lte:now}}}),
    reminders ? db.quest.findMany({where:{studentId:userId,completion:null,due:{gte:now,lte:new Date(+now+3*86_400_000)}}}) : [],
  ]);
  const rows = [
    ...announcements.map(a=>({userId,type:"ANNOUNCEMENT" as const,title:a.title,body:a.body,eventKey:"announcement:"+a.id,createdAt:a.publishedAt})),
    ...deadlines.map(q=>({userId,type:"DEADLINE" as const,title:"Близится дедлайн",body:q.title,href:"/quests/"+q.id,eventKey:"deadline:"+q.id})),
  ];
  if(rows.length) await db.notification.createMany({data:rows,skipDuplicates:true});
}
export function gradesSummary(enrollments: Awaited<ReturnType<typeof gradesFor>>) {
  const grades=enrollments.flatMap(item=>item.grades).sort((a,b)=>+a.assessedAt-+b.assessedAt);
  const final=enrollments.flatMap(item=>item.finalGrade===null?[]:[item.finalGrade]);
  const mean=final.length?weightedMean(final.map(value=>({value,weight:1}))):weightedMean(grades);
  return {average:mean===null?"—":mean.toFixed(2).replace(".",","),
    open:enrollments.filter(item=>!item.creditPassed&&item.finalGrade===null).length, grades, basedOnFinal:Boolean(final.length)};
}
export function scheduleRange(first:string,last:string) {
  return {gte:new Date(first+"T00:00:00Z").valueOf()-36*3_600_000,lt:new Date(addDays(last,1)+"T00:00:00Z").valueOf()+36*3_600_000};
}
export async function scheduleFor(groupId:string,first:string,last:string) {
  const bounds=scheduleRange(first,last);
  const rows=await db.scheduleEvent.findMany({where:{groupId,start:{gte:new Date(bounds.gte),lt:new Date(bounds.lt)}},orderBy:{start:"asc"},include:{subject:true,changes:{orderBy:{createdAt:"desc"}}}});
  return rows.filter(row=>{const day=dayKey(row.start);return day>=first&&day<=last;});
}
