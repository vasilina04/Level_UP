import type { Prisma, XpKind } from "@prisma/client";
import { dayKey, weekOf } from "@/lib/dates";
import { achievementDefinitions, questReward, xpRewards } from "@/lib/rules";

export async function achievementMetrics(tx: Prisma.TransactionClient, studentId: string) {
  const [quests, stages, totalStages] = await Promise.all([
    tx.quest.findMany({where:{studentId,completion:{isNot:null}},include:{completion:true}}),
    tx.studentSemesterProgress.count({where:{studentId}}),
    tx.assessment.findMany({where:{enrollment:{studentId}},select:{stageId:true},distinct:["stageId"]}),
  ]);
  return {
    first:quests.length, labs:quests.filter(q=>q.kind==="LAB").length,
    timely:quests.filter(q=>q.kind==="PERSONAL" && q.completion!.completedAt<=q.due).length,
    explorer:stages, finish:Number(totalStages.length>0 && stages===totalStages.length),
    weeks:new Set(quests.map(q=>weekOf(dayKey(q.completion!.completedAt)))).size,
  };
}
async function awardXp(tx: Prisma.TransactionClient, studentId: string, eventKey: string, kind: XpKind, createdAt: Date) {
  await tx.xpEvent.createMany({data:[{studentId,eventKey,kind,amount:xpRewards[kind],createdAt}],skipDuplicates:true});
}
export async function synchronizeProgress(tx: Prisma.TransactionClient, studentId: string) {
  const verified = await tx.quest.findMany({where:{studentId,kind:{in:["LAB","CREDIT"]},assessment:{passedAt:{not:null},enrollment:{studentId}},completion:null},include:{assessment:true}});
  for (const quest of verified) {
    const completedAt=quest.assessment!.passedAt!;
    await tx.questCompletion.createMany({data:[{questId:quest.id,completedAt,confirmedBy:"ACADEMIC_RECORD"}],skipDuplicates:true});
    await awardXp(tx,studentId,"quest:"+quest.id,quest.kind,completedAt);
  }
  const assessments = await tx.assessment.findMany({where:{enrollment:{studentId}}});
  const stageIds = [...new Set(assessments.map(item=>item.stageId))];
  for (const stageId of stageIds) {
    const items=assessments.filter(item=>item.stageId===stageId);
    if (items.some(item=>!item.passedAt)) continue;
    const completedAt=new Date(Math.max(...items.map(item=>+item.passedAt!)));
    await tx.studentSemesterProgress.createMany({data:[{studentId,stageId,completedAt}],skipDuplicates:true});
    await awardXp(tx,studentId,"stage:"+stageId,"STAGE",completedAt);
  }
  if (assessments.length && assessments.every(item=>item.passedAt)) {
    await awardXp(tx,studentId,"semester:"+stageIds.sort().join(","),"SEMESTER",new Date(Math.max(...assessments.map(item=>+item.passedAt!))));
  }
  const metrics=await achievementMetrics(tx,studentId);
  const eligible=achievementDefinitions.filter(a=>metrics[a.code]>=a.goal).map(a=>a.code);
  const definitions=await tx.achievement.findMany({where:{code:{in:eligible}}});
  for (const achievement of definitions) {
    const earned=await tx.studentAchievement.createMany({data:[{studentId,achievementId:achievement.id}],skipDuplicates:true});
    if (earned.count) await tx.notification.create({data:{userId:studentId,type:"ACHIEVEMENT",title:"Новое достижение",body:achievement.name,href:"/achievements",eventKey:"achievement:"+achievement.id}});
  }
}
export async function lockStudent(tx: Prisma.TransactionClient, studentId: string) {
  await tx.$queryRaw`SELECT "userId" FROM "StudentProfile" WHERE "userId" = ${studentId}::uuid FOR UPDATE`;
}
export async function completePersonal(tx: Prisma.TransactionClient, studentId: string, questId: string, completedAt: Date) {
  const quest=await tx.quest.findFirst({where:{id:questId,studentId,kind:"PERSONAL",assessmentId:null}});
  if (!quest) return false;
  const inserted=await tx.questCompletion.createMany({data:[{questId,completedAt,confirmedBy:"STUDENT"}],skipDuplicates:true});
  if (inserted.count && questReward(quest.kind,quest.due,completedAt,completedAt)) await awardXp(tx,studentId,"quest:"+questId,"PERSONAL",completedAt);
  await synchronizeProgress(tx,studentId);
  return true;
}
