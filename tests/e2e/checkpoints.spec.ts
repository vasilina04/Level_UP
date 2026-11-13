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
    await page.getByLabel("Вопрос преподавателю").fill(question);
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
