import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { dayKey } from "../../src/lib/dates";

const db=new PrismaClient();
test.afterAll(()=>db.$disconnect());

async function login(page:Page,username:string,password:string,destination:RegExp) {
  await page.goto("/login");
  await page.locator('[name="login"]').fill(username);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
  await expect(page).toHaveURL(destination);
}

test("teachers see their lessons and the assigned substitute sees the same change history", async ({page,browser})=>{
  const [teacher,substitute,student]=await Promise.all([
    db.user.findUniqueOrThrow({where:{login:"teacher1"}}),
    db.user.findUniqueOrThrow({where:{login:"teacher2"}}),
    db.studentProfile.findFirstOrThrow({where:{user:{login:"student1"}},include:{group:true}}),
  ]);
  const subject=await db.subject.findFirstOrThrow({where:{instructorId:teacher.id,enrollments:{some:{studentId:student.userId}}}});
  const kind=`Проверочная пара ${randomUUID().slice(0,8)}`;
  const event=await db.scheduleEvent.create({data:{
    groupId:student.groupId,subjectId:subject.id,kind,format:"Очно",building:"Корпус А",room:"А-701",
    start:new Date(Date.now()+60000),end:new Date(Date.now()+3600000),
  }});
  const day=dayKey(event.start),url=`/teacher/schedule?day=${day}`;
  const staffPage=await browser.newPage(),substitutePage=await browser.newPage(),studentPage=await browser.newPage();
  const staffEvent=staffPage.locator("details").filter({has:staffPage.locator(`input[name="id"][value="${event.id}"]`)});
  const lesson=(tab:Page)=>tab.locator("article.lesson").filter({hasText:kind});

  async function openEdit() {
    await staffPage.goto("/staff/academic");
    await staffEvent.locator("summary").click();
  }
  async function save(reason:string) {
    await staffEvent.getByLabel("Причина изменения").fill(reason);
    await staffEvent.getByRole("button",{name:"Сохранить изменение"}).click();
  }

  try {
    await login(page,"teacher1","LevelUpTeacher1!",/\/teacher$/);
    await page.getByRole("navigation",{name:"Основное меню"}).getByRole("link",{name:"Расписание"}).click();
    await expect(page).toHaveURL(/\/teacher\/schedule$/);
    await page.goto(url);
    await expect(page.locator(".schedule-day")).toHaveCount(7);
    await expect(lesson(page)).toContainText(student.group.name);
    await page.getByRole("link",{name:"День",exact:true}).click();
    await expect(page.locator(".schedule-day")).toHaveCount(1);

    await substitutePage.setViewportSize({width:360,height:800});
    await login(substitutePage,"teacher2","LevelUpTeacher2!",/\/teacher$/);
    await substitutePage.getByRole("navigation",{name:"Мобильное меню"}).getByRole("link",{name:"Расписание",exact:true}).click();
    await expect(substitutePage).toHaveURL(/\/teacher\/schedule$/);
    await substitutePage.goto(url);
    await expect(lesson(substitutePage)).toHaveCount(0);

    await login(staffPage,"staff","LevelUpStaff1!",/\/staff$/);
    await openEdit();
    await staffEvent.getByLabel("Аудитория",{exact:true}).fill("А-702");
    await save(`Смена аудитории ${kind}`);
    await expect.poll(async()=> (await db.scheduleEvent.findUniqueOrThrow({where:{id:event.id}})).room).toBe("А-702");
    await page.reload();
    await expect(lesson(page)).toHaveClass(/lesson-changed gold/);
    await expect(lesson(page)).toContainText("Аудитория: А-701 → А-702");

    await openEdit();
    await staffEvent.getByLabel("Изменение").selectOption("teacher");
    await staffEvent.getByLabel("Аккаунт для замены").selectOption(substitute.id);
    await save(`Назначена замена ${kind}`);
    await expect.poll(async()=> (await db.scheduleEvent.findUniqueOrThrow({where:{id:event.id}})).teacherOverrideId).toBe(substitute.id);
    await page.reload();
    await expect(lesson(page)).toContainText(`Ведёт другой преподаватель · ${substitute.name}`);
    await substitutePage.reload();
    await expect(lesson(substitutePage).getByText("Замена преподавателя",{exact:true})).toBeVisible();
    await expect(lesson(substitutePage)).toContainText(student.group.name);
    await lesson(substitutePage).getByText("История изменений",{exact:true}).click();
    await expect(lesson(substitutePage).locator(".schedule-history")).toContainText("Аудитория: А-701 → А-702");
    expect(await substitutePage.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

    await openEdit();
    await staffEvent.getByLabel("Изменение").selectOption("cancel");
    await save(`Отмена ${kind}`);
    await expect.poll(async()=> (await db.scheduleEvent.findUniqueOrThrow({where:{id:event.id}})).cancelled).toBe(true);
    await substitutePage.reload();
    await expect(lesson(substitutePage)).toHaveClass(/lesson-changed rose/);
    await expect(lesson(substitutePage).getByText("Отменено",{exact:true})).toBeVisible();

    await login(studentPage,"student1","LevelUpDemo1!",/dashboard$/);
    await studentPage.goto(url);
    await expect(studentPage).toHaveURL(/\/denied$/);
  } finally {
    await Promise.all([staffPage.close(),substitutePage.close(),studentPage.close()]);
    await db.notification.deleteMany({where:{body:{contains:kind}}});
    await db.auditLog.deleteMany({where:{targetId:event.id}});
    await db.scheduleEvent.delete({where:{id:event.id}});
  }
});
