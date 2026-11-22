import { expect,test,type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const db=new PrismaClient();
test.afterAll(()=>db.$disconnect());
async function login(page:Page,name:string,password:string,path:RegExp){
  await page.goto("/login");
  await page.locator('input[name="login"]').fill(name);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
  await expect(page).toHaveURL(path);
}
test("student asks about a checkpoint and the assigned teacher replies",async({page,browser,baseURL})=>{
  const student=await db.user.findUniqueOrThrow({where:{login:"student1"}});
  const point=await db.assessment.findFirstOrThrow({where:{enrollment:{studentId:student.id},title:"Сдать лабораторную № 3"}});
  const question="Нужно ли приложить результаты запросов? "+randomUUID();
  const answer="Да, добавьте результаты и краткий вывод. "+randomUUID();
  const teacher=await browser.newPage(),other=await browser.newPage();
  try{
    await login(page,"student1","LevelUpDemo1!",/dashboard$/);
    await page.goto("/semester-map/4");
    await page.getByRole("link",{name:/Сдать лабораторную № 3/}).click();
    await expect(page.getByRole("heading",{name:"Что нужно сделать"})).toBeVisible();
    await expect(page.getByText(/подготовьте SQL-запросы/)).toBeVisible();
    await page.getByRole("textbox",{name:"Вопрос преподавателю",exact:true}).fill(question);
    await page.getByRole("button",{name:"Отправить вопрос"}).click();
    await expect(page.getByText(question,{exact:true})).toBeVisible();
    await login(teacher,"teacher1","LevelUpTeacher1!",/\/teacher$/);
    await teacher.getByRole("link",{name:/Сдать лабораторную № 3/}).click();
    await expect(teacher.getByText(question,{exact:true})).toBeVisible();
    await teacher.getByLabel("Ответ преподавателя").fill(answer);
    await teacher.getByRole("button",{name:"Отправить ответ"}).click();
    await expect(teacher.getByText(answer,{exact:true})).toBeVisible();
    await teacher.getByRole("link",{name:"К вопросам студентов"}).click();
    await expect(teacher.getByRole("link",{name:/Сдать лабораторную № 3.*Ответ отправлен/})).toBeVisible();
    await page.goto("/notifications?type=TEACHER_REPLY");
    await page.locator("article").filter({hasText:"Сдать лабораторную № 3"}).getByRole("link",{name:"Открыть"}).first().click();
    await expect(page.getByText(answer,{exact:true})).toBeVisible();
    await login(other,"student2","LevelUpDemo2!",/dashboard$/);
    await other.goto("/checkpoints/"+point.id);
    await expect(other.getByRole("heading",{name:"Страница недоступна"})).toBeVisible();
    const response=await other.request.post("/api/checkpoint-messages",{headers:{origin:new URL(baseURL!).origin},data:{id:randomUUID(),assessmentId:point.id,body:"Чужая переписка"}});
    expect(response.status()).toBe(404);
    await other.goto("/profile");
    await other.getByRole("button",{name:"Выйти из аккаунта"}).click();
    await expect(other).toHaveURL(/login$/);
    await login(other,"teacher2","LevelUpTeacher2!",/\/teacher$/);
    await other.goto("/teacher/checkpoints/"+point.id);
    await expect(other.getByRole("heading",{name:"Страница недоступна"})).toBeVisible();
  }finally{
    await teacher.close();
    await other.close();
    const messages=await db.checkpointMessage.findMany({where:{assessmentId:point.id,body:{in:[question,answer]}}});
    await db.notification.deleteMany({where:{eventKey:{in:messages.map(message=>"checkpoint-reply:"+message.id)}}});
    await db.checkpointMessage.deleteMany({where:{id:{in:messages.map(message=>message.id)}}});
  }
});


test("submitted work stays unconfirmed and unrewarded until the teacher records it",async({page,browser,baseURL})=>{
  const student=await db.user.findUniqueOrThrow({where:{login:"student1"}});
  const teacherUser=await db.user.findUniqueOrThrow({where:{login:"teacher1"}});
  const source=await db.subject.findFirstOrThrow({where:{instructorId:teacherUser.id,plan:{isNot:null}},include:{plan:{include:{versions:{orderBy:{number:"desc"},take:1}}}}});
  const {parsePlan}=await import("../../src/lib/course-data");
  const plan=parsePlan(source.plan?.versions[0]?.data)!;
  const title="Проверяемая работа "+randomUUID().slice(0,8);
  const activity={...plan.activities[0],id:randomUUID(),title,checkpointTitle:title,optional:false};
  const subject=await db.subject.create({data:{title,teacher:teacherUser.name,instructorId:teacherUser.id,credits:3,color:"violet",enrollments:{create:{studentId:student.id}}},include:{enrollments:true}});
  const stage=await db.semesterStage.findUniqueOrThrow({where:{position:4}});
  const point=await db.assessment.create({data:{title,due:new Date(Date.now()+86400000),stageId:stage.id,enrollmentId:subject.enrollments[0].id}});
  const quest=await db.quest.create({data:{title,description:"Отправьте результаты запросов.",kind:"LAB",studentId:student.id,enrollmentId:point.enrollmentId,assessmentId:point.id,due:point.due}});
  await db.coursePlan.create({data:{subjectId:subject.id,versions:{create:{number:1,authorId:teacherUser.id,reason:"Тест проверки работы",data:{...plan,title,activities:[activity]}}}}});
  const text="Результаты SQL и выводы https://example.test/qa-work-"+randomUUID();
  const teacher=await browser.newPage();
  const xp=()=>db.xpEvent.count({where:{studentId:student.id,eventKey:"quest:"+quest.id}});
  try {
    await login(page,"student1","LevelUpDemo1!",/dashboard$/);
    await page.goto("/checkpoints/"+point.id);
    await page.getByLabel("Тип сообщения").selectOption("work");
    await page.getByLabel("Результат или ссылка на работу").fill(text);
    await page.getByRole("button",{name:"Отправить на проверку"}).click();
    await expect(page.getByText(new RegExp("Результаты SQL и выводы"))).toBeVisible();
    expect((await db.assessment.findUniqueOrThrow({where:{id:point.id}})).passedAt).toBeNull();
    expect(await xp()).toBe(0);
    await login(teacher,"teacher1","LevelUpTeacher1!",/\/teacher$/);
    await teacher.goto("/teacher/checkpoints/"+point.id);
    await expect(teacher.getByText(/Работа на проверку/)).toBeVisible();
    await teacher.getByRole("link",{name:"Проверить и выставить результат"}).click();
    await expect(teacher).toHaveURL(new RegExp("/teacher/courses/"+subject.id+"/results$"));
    const data={operation:"gradebookActivity",subjectId:subject.id,activityId:activity.id,rows:[{enrollmentId:point.enrollmentId,status:"GRADED",points:activity.max,confirmCheckpoint:"on",expectedAt:null}]};
    const post=()=>teacher.request.post("/api/academic-planning",{headers:{origin:new URL(baseURL!).origin},data});
    expect((await post()).status()).toBe(200);
    expect((await post()).status()).toBe(200);
    expect(await xp()).toBe(1);
    await page.reload();
    await expect(page.getByText("Завершена",{exact:true})).toBeVisible();
  } finally {
    await teacher.close();
    await db.notification.deleteMany({where:{userId:student.id,OR:[{href:{contains:subject.id}},{href:"/checkpoints/"+point.id}]}});
    await db.xpEvent.deleteMany({where:{studentId:student.id,eventKey:"quest:"+quest.id}});
    await db.enrollment.delete({where:{id:point.enrollmentId}});
  }
});
