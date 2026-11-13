import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { createHash } from "node:crypto";
import { achievementDefinitions } from "../src/lib/rules";
import { addDays, dayKey, weekOf } from "../src/lib/dates";
import { completePersonal, synchronizeProgress } from "../src/lib/progress";
if (existsSync(".env")) process.loadEnvFile(".env");
const db=new PrismaClient();
export function key(label:string) {
  const hex=createHash("sha256").update("level-up:"+label).digest("hex");
  return hex.slice(0,8)+"-"+hex.slice(8,12)+"-4"+hex.slice(13,16)+"-8"+hex.slice(17,20)+"-"+hex.slice(20,32);
}
const calendar=process.env.DEMO_DATE||dayKey(new Date());
const at=(days:number,time="14:00")=>new Date(addDays(calendar,days)+"T"+time+":00+10:00");
const starts=["Введение","Лабораторные","Аттестация","Курсовые","Зачёты","Экзамены"];
const descriptions=[
  "Познакомьтесь с дисциплинами и пройдите вводные контрольные точки.",
  "Закрепите теорию на практических занятиях и сдайте лабораторные работы.",
  "Проверьте знания в середине семестра и посмотрите, какие темы стоит повторить.",
  "Соберите результаты работы в проект и подготовьте защиту.",
  "Закройте зачётные работы и проверьте допуск к сессии.",
  "Сверьте даты экзаменов и завершите семестр.",
];
const instructions=[
  "Ознакомьтесь с программой дисциплины. Запишите три ключевые темы и подготовьте один вопрос к первой консультации.",
  "Выполните вариант лабораторной работы. Подготовьте отчёт с целью, ходом выполнения, результатами и выводом. Покажите преподавателю результат на занятии.",
  "Повторите материалы первых двух модулей. Выполните задания промежуточной аттестации и поясните ход решения в каждом ответе.",
  "Подготовьте план курсового проекта, черновой результат и список источников. Принесите их на консультацию и покажите, что уже готово.",
  "Соберите выполненные работы и исправьте замечания преподавателя. На зачёте представьте результаты и ответьте на вопросы по своей работе.",
  "Подготовьте ответы по темам дисциплины и разберите типовые практические задания. Сверьте время и аудиторию в расписании сессии.",
];
const profiles=[
  {login:"student1",name:"Алексей Лаврин",password:"LevelUpDemo1!",faculty:"Информационные технологии",group:"ИТ-201",program:"Прикладная информатика",year:2, done:13,
    subjects:[["Алгоритмы и структуры данных","Д. В. Соколов","violet"],["Базы данных","Е. И. Орлова","blue"],["Веб-разработка","А. Р. Волков","mint"],["Дискретная математика","И. Н. Лебедева","rose"]],
    titles:["Сдать лабораторную № 3","Повторить SQL-запросы","Подготовить план курсовой","Разобрать графы и деревья","Проверить конспект к зачёту"]},
  {login:"student2",name:"Марина Ветрова",password:"LevelUpDemo2!",faculty:"Дизайн и цифровые медиа",group:"ДИЗ-301",program:"Цифровой дизайн",year:3,done:8,
    subjects:[["Дизайн интерфейсов","В. О. Яковлева","rose"],["Типографика","М. А. Гущина","gold"],["Визуальные коммуникации","А. В. Фомина","violet"],["Моушн-дизайн","К. М. Зорин","blue"]],
    titles:["Защитить прототип интерфейса","Собрать референсы","Подготовить сетку проекта","Обновить портфолио","Повторить основы анимации"]},
];
async function seed() {
  if(process.env.ENABLE_DEMO_SEED!=="1") throw new Error("Set ENABLE_DEMO_SEED=1 to load the fictional accounts.");
  const staffId=key("staff");
  const staffHash=await hash("LevelUpStaff1!");
  await db.user.upsert({where:{id:staffId},update:{passwordHash:staffHash},create:{id:staffId,login:"staff",name:"Ольга Миронова",passwordHash:staffHash,role:"STAFF",staff:{create:{}}}});
  for (const [i,title] of starts.entries()) await db.semesterStage.upsert({where:{position:i+1},update:{},create:{id:key("stage"+i),position:i+1,title,description:descriptions[i]}});
  for (const {goal:_,...a} of achievementDefinitions) await db.achievement.upsert({where:{code:a.code},update:{},create:{...a,id:key(a.code)}});
  for (const [p,student] of profiles.entries()) {
    const id=key(student.login), groupId=key(student.group), facultyId=key(student.faculty);
    await db.faculty.upsert({where:{id:facultyId},update:{},create:{id:facultyId,name:student.faculty}});
    await db.group.upsert({where:{id:groupId},update:{},create:{id:groupId,name:student.group}});
    const passwordHash=await hash(student.password);
    await db.user.upsert({where:{id},update:{passwordHash},create:{id,login:student.login,name:student.name,passwordHash,
      student:{create:{facultyId,groupId,program:student.program,year:student.year,academicYear:"2026/27"}}}});
    for (const [i,[title,teacher,color]] of student.subjects.entries()) {
      const subjectId=key(id+"subject"+i), enrollmentId=key(id+"enrollment"+i);
      const instructorId=key("teacher:"+student.login+":"+i);
      const login=i===1?(p===0?"teacher1":"teacher2"):"teacher_"+p+"_"+i;
      const passwordHash=await hash(i===1?(p===0?"LevelUpTeacher1!":"LevelUpTeacher2!"):"LevelUpTeacherDemo!");
      await db.user.upsert({where:{id:instructorId},update:{passwordHash},create:{id:instructorId,login,name:teacher,passwordHash,role:"TEACHER"}});
      await db.subject.upsert({where:{id:subjectId},update:{instructorId},create:{id:subjectId,title,teacher,color,credits:i%2+3,instructorId}});
      await db.enrollment.upsert({where:{id:enrollmentId},update:{},create:{id:enrollmentId,studentId:id,subjectId,finalGrade:i===2?5:i===3?(p===0?4:5):null,creditPassed:i>=2}});
      for(const [g,label] of ["Практическая работа","Промежуточная работа","Контрольная работа"].entries()) {
        if(g===2&&i===0) continue;
        const gradeId=key(enrollmentId+"grade"+g);
        const value=(p===0?[[3,4,4,5],[4,3,5,4],[4,5,5,4]]:[[4,3,4,4],[4,4,5,3],[5,4,5,5]])[g][i];
        const weight=[1,2,4][g];
        await db.grade.upsert({where:{id:gradeId},update:{weight},create:{id:gradeId,enrollmentId,title:label,value,weight,points:value*2,maxPoints:10,assessedAt:at(-30+g*8+i)}});
      }
      const examId=key(enrollmentId+"exam");
      await db.exam.upsert({where:{id:examId},update:{},create:{id:examId,enrollmentId,start:at(31+i*2,"10:00"),kind:i%2?"Зачёт":"Экзамен",room:"А-"+(305+i)}});
    }
    for (let i=0;i<20;i++) {
      const assessmentId=key(id+"assessment"+i);
      const stage=i<4?0:i<8?1:i<12?2:i<15?3:i<18?4:5;
      const enrollmentId=key(id+"enrollment"+i%4);
      const due=at(i<student.done?i-student.done:2+(i-student.done)*4);
      const title=i===student.done?student.titles[0]:[ "Вводная работа", "Лабораторная работа", "Контрольная работа", "Этап проекта", "Зачётная работа", "Экзаменационная работа"][stage]+" № "+(i%4+1);
      const weight=[1,1,2,3,3,4][stage]+Number(i%4===3);
      const task=i===student.done
        ?p===0?"Выполните лабораторную № 3 по базам данных: подготовьте SQL-запросы, проверьте результаты на тестовых данных и приложите их к отчёту для преподавателя.":"Подготовьте интерактивный прототип: проверьте основные пользовательские сценарии, покажите навигацию и обоснуйте решения на защите."
        :instructions[stage];
      await db.assessment.upsert({where:{id:assessmentId},update:{weight,instructions:task},create:{id:assessmentId,stageId:key("stage"+stage),enrollmentId,title,due,weight,instructions:task,passedAt:i<student.done?at(-34+i*2):null}});
      if(i<Math.min(student.done,7)||i===student.done||i===18) {
        const questId=key(id+"academic"+i);
        await db.quest.upsert({where:{id:questId},update:{},create:{id:questId,studentId:id,enrollmentId,assessmentId,title,due,kind:i===18?"CREDIT":"LAB",
          description:"Подготовьте работу по требованиям преподавателя. Квест завершится после подтверждения контрольной точки в учебных данных."}});
      }
    }
    for(let i=0;i<9;i++) {
      const questId=key(id+"personal"+i);
      await db.quest.upsert({where:{id:questId},update:{},create:{id:questId,studentId:id,enrollmentId:key(id+"enrollment"+((i+1)%4)),
        title:i<4?student.titles[i+1]:"Учебная подготовка № "+(i-3),
        description:"Запланируйте время, выполните задачу и отметьте результат. За выполнение в срок начисляется опыт.",
        due:at([1,4,8,-4,-8,-14,-20,-27,-35][i]),kind:"PERSONAL"}});
      if(i>=4&&i< (p===0?9:6)) await db.$transaction(tx=>completePersonal(tx,id,questId,at([0,0,0,0,-9,-15,-21,-28,-36][i])));
    }
    await db.$transaction(tx=>synchronizeProgress(tx,id));
    const monday=weekOf(calendar);
    const mondayDelta=(+new Date(monday)-+new Date(calendar))/86_400_000;
    for(const offset of [-7,0,7,14]) for(let d=0;d<6;d++) {
      const days=mondayDelta+offset+d;
      for(let k=0;k<(d===5?1:2);k++) {
        const i=(d+k+p)%4, changed=offset===0&&d===4&&k===0;
        const eventId=key(id+"event"+offset+":"+d+":"+k);
        const [start,end]=k===0?[p===0?"10:10":"08:30",p===0?"11:40":"10:00"]:["12:00","13:30"];
        await db.scheduleEvent.upsert({where:{id:eventId},update:{},create:{id:eventId,groupId,subjectId:key(id+"subject"+i),kind:k===0?"Лекция":"Практика",format:i===3&&!changed?"Онлайн":"Очно",start:at(days,start),end:at(days,end),room:changed?"Б-302":i===3?"Онлайн":"А-"+(205+i+p*10),building:changed?"Корпус Б":i===3?null:"Корпус А",note:changed?"Перенос в другую аудиторию":null}});
        if(changed) {
          const changeId=key(eventId+"change");
          await db.scheduleChange.upsert({where:{id:changeId},update:{},create:{id:changeId,eventId,previous:{room:"А-"+(205+i+p*10)},current:{room:"Б-302"},reason:"Перенос в другую аудиторию",createdAt:at(-1)}});
          await db.notification.createMany({data:[{userId:id,type:"SCHEDULE",title:"Изменилась аудитория",body:student.subjects[i][0]+" · Б-302",href:"/schedule",eventKey:"seed-change",createdAt:at(-1)}],skipDuplicates:true});
        }
      }
    }
    const documentId=key(id+"document");
    await db.documentRequest.upsert({where:{id:documentId},update:{},create:{id:documentId,studentId:id,type:p===0?"CERTIFICATE":"CONSULTATION",status:p===0?"REVIEW":"READY",recipient:p===0?"По месту требования":"Учебный отдел",details:p===0?"Подтверждение обучения для проездного":"Консультация по подготовке учебного проекта",createdAt:at(-6)}});
    const statuses=p===0?["SUBMITTED","REVIEW"] as const:["SUBMITTED","REVIEW","APPROVED","READY"] as const;
    for(const [i,status] of statuses.entries()){
      const historyId=key(documentId+status);
      await db.documentStatusHistory.upsert({where:{id:historyId},update:{},create:{id:historyId,documentId,actorId:i?staffId:id,status,comment:i?"Обновлено учебным отделом":null,createdAt:at(-6+i)}});
    }
    await db.announcement.upsert({where:{id:key(id+"announcement")},update:{},create:{id:key(id+"announcement"),groupId,title:p===0?"График зимней сессии":"Просмотр учебных проектов",body:p===0?"Даты экзаменов опубликованы в разделе «Успеваемость».":"Принесите прототип и материалы исследования на следующий просмотр.",publishedAt:at(-2)}});
    await db.notification.createMany({data:[{userId:id,type:"GRADE",title:"Добавлены оценки",body:student.subjects[0][0],href:"/grades",eventKey:"seed-grade",createdAt:at(-3)}],skipDuplicates:true});
  }
  console.log("Demo data ready.");
}
seed().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());
