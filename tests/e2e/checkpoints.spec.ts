import { expect,test,type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const db=new PrismaClient();
async function inspectWork(page:Page,name:string) {
  const original=page.viewportSize();
  for(const width of [360,390,768,1440]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if(width===390) expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
    if(process.env.AUDIT_EVIDENCE_DIR) {
      const folder=join(process.env.AUDIT_EVIDENCE_DIR,String(width));
      await mkdir(folder,{recursive:true});
      await page.screenshot({path:join(folder,name+".png"),fullPage:true,animations:"disabled"});
      await page.screenshot({path:join(folder,name+".jpg"),type:"jpeg",quality:85,fullPage:true,animations:"disabled"});
    }
  }
  if(original) await page.setViewportSize(original);
}
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
  test.setTimeout(180000);
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
  const teacherContext=await browser.newContext({baseURL});
  const teacher=await teacherContext.newPage();
  const xp=()=>db.xpEvent.count({where:{studentId:student.id,eventKey:"quest:"+quest.id}});
  try {
    await login(page,"student1","LevelUpDemo1!",/dashboard$/);
    await page.goto("/checkpoints/"+point.id);
    await expect(page.getByText("Не начато",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Начать работу"}).click();
    await expect(page.getByText("В процессе",{exact:true})).toBeVisible();
    await page.getByLabel("Тип сообщения").selectOption("work");
    await page.getByLabel("Результат или ссылка на работу").fill(text);
    await page.getByRole("button",{name:"Отправить на проверку"}).click();
    await expect(page.getByText(new RegExp("Результаты SQL и выводы"))).toBeVisible();
    expect((await db.assessment.findUniqueOrThrow({where:{id:point.id}})).passedAt).toBeNull();
    expect(await xp()).toBe(0);
    const submitted=await db.checkpointSubmission.findFirstOrThrow({where:{assessmentId:point.id}});
    const headers={origin:new URL(baseURL!).origin};
    expect((await page.request.post("/api/checkpoint-work",{headers,data:{operation:"submit",assessmentId:point.id,id:submitted.id,body:text}})).status()).toBe(200);
    expect((await page.request.post("/api/checkpoint-messages",{headers,data:{assessmentId:point.id,id:submitted.id,body:"Работа на проверку\n"+text}})).status()).toBe(200);
    expect((await page.request.post("/api/checkpoint-work",{headers,data:{operation:"submit",assessmentId:point.id,id:randomUUID(),body:text}})).status()).toBe(409);
    expect(await db.checkpointSubmission.count({where:{assessmentId:point.id}})).toBe(1);
    await inspectWork(page,"student-submitted-work");
    await login(teacher,"teacher1","LevelUpTeacher1!",/\/teacher$/);
    await teacher.goto("/teacher/checkpoints/"+point.id);
    await expect(teacher.getByText(/Работа на проверку/)).toBeVisible();
    await teacher.getByLabel("Ответ преподавателя").fill("Работу получил, сейчас проверю.");
    await teacher.getByRole("button",{name:"Отправить ответ"}).click();
    await expect(teacher.getByText("Работу получил, сейчас проверю.",{exact:true})).toBeVisible();
    await inspectWork(teacher,"teacher-work-review");
    await teacher.getByLabel("Замечания преподавателя").fill("Добавьте вывод по каждому SQL-запросу.");
    await teacher.getByRole("button",{name:"Сохранить решение"}).click();
    await expect(teacher.getByText("На доработке",{exact:true}).first()).toBeVisible();
    const firstSubmission=await db.checkpointSubmission.findFirstOrThrow({where:{assessmentId:point.id}});
    expect(await xp()).toBe(0);
    await page.reload();
    await expect(page.locator("article").getByText(/Добавьте вывод по каждому SQL-запросу\./)).toBeVisible();
    await inspectWork(page,"student-work-revision");
    await page.getByLabel("Тип сообщения").selectOption("work");
    await page.getByLabel("Результат или ссылка на работу").fill(text+" Исправлены выводы.");
    await page.getByRole("button",{name:"Отправить на проверку"}).click();
    await expect(page.getByRole("heading",{name:"Попытка 2"})).toBeVisible();
    await teacher.reload();
    const latest=await db.checkpointSubmission.findFirstOrThrow({where:{assessmentId:point.id},orderBy:{submittedAt:"desc"}});
    const data={operation:"review",assessmentId:point.id,id:latest.id,decision:"APPROVED",comment:"Работа проверена",points:activity.max,grade:5};
    const post=(actor:Page,body:object)=>actor.request.post("/api/checkpoint-work",{headers:{origin:new URL(baseURL!).origin},data:body});
    expect((await post(page,data)).status()).toBe(404);
    expect((await page.request.post("/api/checkpoint-work",{headers:{origin:"https://untrusted.example"},data:{operation:"start",assessmentId:point.id}})).status()).toBe(403);
    const other=await browser.newPage();
    try {
      await login(other,"student2","LevelUpDemo2!",/dashboard$/);
      expect((await post(other,{operation:"submit",assessmentId:point.id,id:randomUUID(),body:"Попытка чужой отправки"})).status()).toBe(404);
      await other.context().clearCookies();
      await login(other,"teacher2","LevelUpTeacher2!",/\/teacher$/);
      expect((await post(other,data)).status()).toBe(404);
    } finally {await other.close();}
    expect((await post(teacher,{...data,id:firstSubmission.id})).status()).toBe(409);
    expect((await post(teacher,{...data,points:activity.max+1})).status()).toBe(400);
    await teacher.getByLabel("Решение по работе").selectOption("APPROVED");
    await teacher.getByLabel("Замечания преподавателя").fill(data.comment);
    await teacher.getByLabel("Баллы за работу").fill(String(activity.max));
    await teacher.getByLabel("Оценка за работу").selectOption("5");
    await teacher.getByRole("button",{name:"Сохранить решение"}).click();
    await expect(teacher.getByText("Выполнено",{exact:true})).toBeVisible();
    expect((await post(teacher,data)).status()).toBe(200);
    expect(await db.grade.findUnique({where:{id:point.id}})).toMatchObject({points:activity.max,value:5});
    expect(await db.courseResult.findUnique({where:{enrollmentId_activityId:{enrollmentId:point.enrollmentId,activityId:activity.id}}})).toMatchObject({points:activity.max,status:"GRADED"});
    expect(await xp()).toBe(1);
    await page.reload();
    await expect(page.getByText("Выполнено",{exact:true})).toBeVisible();
  } finally {
    await teacherContext.close();
    await db.notification.deleteMany({where:{userId:student.id,OR:[{href:{contains:subject.id}},{href:"/checkpoints/"+point.id}]}});
    await db.xpEvent.deleteMany({where:{studentId:student.id,eventKey:"quest:"+quest.id}});
    await db.enrollment.delete({where:{id:point.enrollmentId}});
  }
});
