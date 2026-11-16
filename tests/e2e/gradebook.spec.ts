import { expect,test,type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { Activity } from "../../src/lib/course-data";

const db=new PrismaClient();
test.afterAll(()=>db.$disconnect());

async function login(page:Page,username:string,password:string,destination:RegExp) {
  await page.goto("/login");
  await page.locator('[name="login"]').fill(username);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
  await expect(page).toHaveURL(destination);
}

test("the teacher fills a roster, saves selected rows and cannot write another course's grades",async({page,browser,baseURL})=>{
  const [teacher,first,second]=await Promise.all([
    db.user.findUniqueOrThrow({where:{login:"teacher1"}}),
    db.user.findUniqueOrThrow({where:{login:"student1"},include:{student:{include:{group:true}}}}),
    db.user.findUniqueOrThrow({where:{login:"student2"},include:{student:{include:{group:true}}}}),
  ]);
  const {facultyId,groupId,program,year,academicYear}=first.student!;
  const third=await db.user.create({data:{name:"Тестовый студент ведомости",login:`qa_grade_${randomUUID()}`,passwordHash:first.passwordHash,
    student:{create:{facultyId,groupId,program,year,academicYear}}}});
  const activity:Activity={id:randomUUID(),title:"Проверочная работа",kind:"CONTROL",startsAt:new Date().toISOString(),place:"А-201",format:"Очно",
    description:"Решите задачу",topics:"Основы курса",requirements:"Приложите решение",max:20,weight:1,materials:"",optional:false,registration:false};
  const subject=await db.subject.create({data:{title:`QA ведомость ${randomUUID().slice(0,8)}`,teacher:teacher.name,instructorId:teacher.id,credits:2,color:"violet",
    enrollments:{create:[first,second,third].map(user=>({studentId:user.id}))}},include:{enrollments:true}});
  const original=await db.enrollment.findFirstOrThrow({where:{studentId:first.id,subjectId:{not:subject.id}}});
  const firstRow=subject.enrollments.find(row=>row.studentId===first.id)!,secondRow=subject.enrollments.find(row=>row.studentId===second.id)!;
  const route=`/teacher/courses/${subject.id}/results`,outside=await browser.newPage();
  const row=(name:string)=>page.locator(".gradebook-row").filter({hasText:name});
  const post=(tab:Page,data:object)=>tab.request.post("/api/academic-planning",{headers:{origin:new URL(baseURL!).origin},data});
  try {
    await login(page,"teacher1","LevelUpTeacher1!",/\/teacher$/);
    await page.setViewportSize({width:360,height:800});
    await page.goto(route);
    await expect(row(first.name)).toContainText(first.student!.group.name);
    await expect(row(second.name)).toContainText(second.student!.group.name);
    await expect(page.locator(".gradebook-row")).toHaveCount(3);
    await row(first.name).getByRole("combobox").selectOption("4");
    await row(second.name).getByRole("combobox").selectOption("5");
    await page.getByRole("button",{name:"Сохранить итоговые оценки"}).click();
    await expect(page.getByText("Итоговые оценки сохранены.")).toBeVisible();
    await page.reload();
    await expect(row(first.name).getByRole("combobox")).toHaveValue("4");
    await expect(row(second.name).getByRole("combobox")).toHaveValue("5");
    await expect(row(third.name).getByRole("combobox")).toHaveValue("");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await login(outside,"student1","LevelUpDemo1!",/dashboard$/);
    await outside.goto(`/rating?course=${subject.id}`);
    await expect(outside.getByText("Итоговая оценка: 4")).toBeVisible();
    await outside.goto("/profile");
    await outside.getByRole("button",{name:"Выйти из аккаунта"}).click();
    await expect(outside).toHaveURL(/login$/);

    const request={operation:"gradebookFinal",subjectId:subject.id,rows:[{enrollmentId:firstRow.id,grade:3,expected:4},{enrollmentId:original.id,grade:3,expected:original.finalGrade}]};
    expect((await post(page,request)).status()).toBe(404);
    expect((await post(page,{...request,rows:[{enrollmentId:firstRow.id,grade:3,expected:null}]})).status()).toBe(409);
    await login(outside,"teacher2","LevelUpTeacher2!",/\/teacher$/);
    expect((await post(outside,{...request,rows:[{enrollmentId:firstRow.id,grade:3,expected:4}]})).status()).toBe(404);
    expect((await db.enrollment.findUniqueOrThrow({where:{id:firstRow.id}})).finalGrade).toBe(4);

    const plan={title:subject.title,period:"Демо",rule:null,activities:[activity]};
    await db.coursePlan.create({data:{subjectId:subject.id,draft:plan,versions:{create:{number:1,data:plan,authorId:teacher.id,reason:"Тест списка"}}}});
    const invalid=await post(page,{operation:"gradebookActivity",subjectId:subject.id,activityId:activity.id,rows:[
      {enrollmentId:firstRow.id,status:"GRADED",points:10,expectedAt:null},
      {enrollmentId:secondRow.id,status:"GRADED",points:21,expectedAt:null},
    ]});
    expect(invalid.status()).toBe(400);
    expect(await db.courseResult.count({where:{enrollment:{subjectId:subject.id}}})).toBe(0);
    await page.goto(route);
    await page.getByLabel("За что выставить оценку").selectOption(activity.id);
    await page.getByRole("button",{name:"Показать ведомость"}).click();
    await row(first.name).getByRole("spinbutton").fill("0");
    await row(second.name).getByRole("combobox").selectOption("MISSED");
    await page.getByRole("button",{name:"Сохранить результаты"}).click();
    await expect(page.getByText("Результаты сохранены.")).toBeVisible();
    await page.reload();
    await expect(row(first.name).getByRole("spinbutton")).toHaveValue("0");
    await expect(row(second.name).getByRole("combobox")).toHaveValue("MISSED");
    await expect(row(third.name).getByRole("combobox")).toHaveValue("");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const results=await db.courseResult.findMany({where:{enrollment:{subjectId:subject.id}},select:{enrollmentId:true,status:true,points:true}});
    expect(results).toHaveLength(2);
    expect(results).toEqual(expect.arrayContaining([{enrollmentId:firstRow.id,status:"GRADED",points:0},{enrollmentId:secondRow.id,status:"MISSED",points:null}]));
  } finally {
    await outside.close();
    await db.notification.deleteMany({where:{href:`/rating?course=${subject.id}`}});
    await db.auditLog.deleteMany({where:{targetId:{in:subject.enrollments.map(item=>item.id)}}});
    await db.enrollment.deleteMany({where:{subjectId:subject.id}});
    await db.user.delete({where:{id:third.id}});
  }
});
