import {expect,test,type Page} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {createHash} from "node:crypto";
const db=new PrismaClient();
const key=(label:string)=>{
  const h=createHash("sha256").update("level-up:"+label).digest("hex");
  return h.slice(0,8)+"-"+h.slice(8,12)+"-4"+h.slice(13,16)+"-8"+h.slice(17,20)+"-"+h.slice(20,32);
};
const alex=key("student1"),marina=key("student2");
async function login(page:Page,user="student1",password="LevelUpDemo1!") {
  await page.goto("/login");
  await page.getByLabel("Логин",{exact:true}).fill(user);
  await page.getByLabel("Пароль",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
}
test.afterAll(()=>db.$disconnect());
test("private pages, validation, both accounts, session restoration and logout",async({page})=>{
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await login(page,"student1","incorrect");
  await expect(page.getByRole("alert").filter({hasText:"Неверный логин"})).toBeVisible();
  await login(page);
  await expect(page.getByRole("heading",{name:"Привет, Алексей!"})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading",{name:"Привет, Алексей!"})).toBeVisible();
  await page.goto("/profile");
  await page.getByRole("button",{name:"Выйти из аккаунта"}).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page,"student2","LevelUpDemo2!");
  await expect(page.getByRole("heading",{name:"Привет, Марина!"})).toBeVisible();
  await page.goto("/grades");
  await expect(page.locator("summary").getByText("Типографика",{exact:true})).toBeVisible();
  await expect(page.getByText("Базы данных",{exact:true})).toHaveCount(0);
});
test("student isolation by role and ownership",async({page})=>{
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto("/documents/"+key(marina+"document"));
  await expect(page.getByRole("heading",{name:"Страница недоступна"})).toBeVisible();
  await page.goto("/quests/"+key(marina+"personal0"));
  await expect(page.getByRole("heading",{name:"Страница недоступна"})).toBeVisible();
  await page.goto("/staff/academic");
  await expect(page.getByRole("heading",{name:"Нет доступа"})).toBeVisible();
  const result=await page.request.post("/api/achievements/"+key("first"),{data:{studentId:marina}});
  expect(result.ok()).toBe(false);
  const foreign=await db.studentAchievement.count({where:{studentId:marina}});
  expect(foreign).toBeGreaterThan(0);
});
test("personal quest persists and awards XP once under concurrent submission",async({page,browser})=>{
  const questId=key(alex+"personal0");
  await db.questCompletion.deleteMany({where:{questId}});
  await db.xpEvent.deleteMany({where:{studentId:alex,eventKey:"quest:"+questId}});
  await db.quest.update({where:{id:questId},data:{due:new Date(Date.now()+86_400_000)}});
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  const duplicate=await browser.newContext({storageState:await page.context().storageState()});
  try {
    const second=await duplicate.newPage();
    await Promise.all([page.goto("/quests/"+questId),second.goto("/quests/"+questId)]);
    await Promise.all([page.getByRole("button",{name:"Отметить выполненным"}).click(),second.getByRole("button",{name:"Отметить выполненным"}).click()]);
    await expect.poll(()=>db.questCompletion.count({where:{questId}})).toBe(1);
    await Promise.all([page.reload(),second.reload()]);
    await expect(page.getByText(/Выполнен \d/)).toBeVisible();
    await expect(second.getByText(/Выполнен \d/)).toBeVisible();
    const events=await db.xpEvent.findMany({where:{studentId:alex,eventKey:"quest:"+questId}});
    expect(events.map(e=>e.amount)).toEqual([30]);
  } finally { await duplicate.close(); }
});
test("staff confirmation closes an academic quest and unlocks an achievement",async({page,browser})=>{
  const questId=key(alex+"academic13"),achievementId=key("labs");
  await db.assessment.update({where:{id:key(alex+"assessment13")},data:{passedAt:null}});
  await db.questCompletion.deleteMany({where:{questId}});
  await db.xpEvent.deleteMany({where:{studentId:alex,eventKey:"quest:"+questId}});
  await db.notification.deleteMany({where:{userId:alex,eventKey:{in:["achievement:"+achievementId,"assessment:"+key(alex+"assessment13")]}}});
  await db.studentAchievement.deleteMany({where:{studentId:alex,achievementId}});
  const remaining=["academic0","academic1","academic2","academic3"].map(label=>key(alex+label));
  const removed=await db.questCompletion.findMany({where:{quest:{studentId:alex,kind:"LAB"},questId:{notIn:remaining}}});
  await db.questCompletion.deleteMany({where:{questId:{in:removed.map(row=>row.questId)}}});
  await db.assessment.updateMany({where:{quest:{studentId:alex,kind:"LAB",id:{notIn:[...remaining,questId]}}},data:{passedAt:null}});
  const staff=await browser.newPage();
  try {
    await login(page);
    await expect(page).toHaveURL(/dashboard$/);
    await page.goto("/quests/"+questId);
    await expect(page.getByText("Ожидает подтверждения в учебных данных.")).toBeVisible();
    await login(staff,"staff","LevelUpStaff1!");
    await expect(staff).toHaveURL(/\/staff$/);
    await staff.goto("/staff/academic");
    const assessment=staff.locator("details").filter({hasText:"Сдать лабораторную № 3"});
    await assessment.locator("summary").click();
    await assessment.getByRole("button",{name:"Подтвердить выполнение"}).click();
    await expect.poll(()=>db.studentAchievement.count({where:{studentId:alex,achievementId}})).toBe(1);
    await page.reload();
    await expect(page.getByText(/Выполнен \d/)).toBeVisible();
  } finally {
    for (const row of removed) {
      await db.questCompletion.upsert({where:{questId:row.questId},update:{},create:row});
      await db.assessment.updateMany({where:{quest:{id:row.questId}},data:{passedAt:row.completedAt}});
    }
    await staff.close();
  }
});
test("student submits a request, staff reviews, student receives the change",async({page,browser})=>{
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto("/documents/new");
  const details="Проверка заявки "+Date.now();
  await page.getByLabel("Адресат").fill("По месту требования");
  await page.getByLabel("Цель обращения").fill(details);
  await page.getByRole("button",{name:"Сохранить черновик"}).click();
  await expect(page).toHaveURL(/documents\/[\da-f-]+$/);
  const path=new URL(page.url()).pathname,id=path.split("/").at(-1)!;
  await expect.poll(async()=> (await db.documentRequest.findUnique({where:{id}}))?.status).toBe("DRAFT");
  await page.getByLabel("Электронная почта",{exact:true}).fill("student1@example.test");
  await page.getByLabel("Подтверждаю, что проверил(а) данные").check();
  await page.getByRole("button",{name:"Отправить заявку"}).click();
  await expect.poll(async()=> (await db.documentRequest.findUnique({where:{id}}))?.status).toBe("SUBMITTED");
  const staff=await browser.newPage();
  try {
    await login(staff,"staff","LevelUpStaff1!");
    await expect(staff).toHaveURL(/\/staff$/);
    await staff.goto("/staff/"+id);
    await staff.getByLabel("Комментарий").fill("Проверено сотрудником");
    await staff.getByRole("button",{name:"Обновить статус"}).click();
    await expect(staff.getByText("Проверено сотрудником")).toBeVisible();
    await page.reload();
    await expect(page.getByText("На рассмотрении",{exact:true}).first()).toBeVisible();
    await page.goto("/notifications?type=DOCUMENT");
    await expect(page.getByText("На рассмотрении",{exact:true}).first()).toBeVisible();
  } finally { await staff.close(); }
});
test("keyboard navigation, filters and empty states",async({page})=>{
  await page.goto("/login");
  await page.bringToFront();
  await expect(page.getByLabel("Логин",{exact:true})).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Логин",{exact:true})).toBeFocused();
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto("/schedule?day=2099-11-15");
  await expect(page.getByText("Занятий нет")).toBeVisible();
  await page.goto("/notifications?read=read&type=DEADLINE");
  await expect(page.getByText("Уведомлений нет")).toBeVisible();
});
test("shows pending sign-in and recovers when a submission loses its connection",async({page})=>{
  await page.goto("/login");
  await page.getByLabel("Логин",{exact:true}).fill("student1");
  await page.getByLabel("Пароль",{exact:true}).fill("LevelUpDemo1!");
  let releaseRequest!:()=>void;
  const release=new Promise<void>(resolve=>{releaseRequest=resolve;});
  await page.route("**/api/auth/callback/credentials*",async route=>{
    if(route.request().method()!=="POST") return route.continue();
    await release;
    await route.abort("internetdisconnected");
  });
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
  try {
    await expect(page.getByRole("button",{name:"Подождите…"})).toBeDisabled();
  } finally { releaseRequest(); }
  await expect(page.getByRole("alert").filter({hasText:"Проверьте подключение"})).toBeVisible();
  await page.unroute("**/api/auth/callback/credentials*");
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
  await expect(page).toHaveURL(/dashboard$/);
});
test("responsive widths and mobile map",async({page})=>{
  await login(page);
  await expect(page).toHaveURL(/dashboard$/);
  for (const width of [360,375,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for(const path of ["/dashboard","/semester-map","/schedule","/grades","/documents/new"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth),width+" "+path).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({width:360,height:800});
  await page.goto("/semester-map");
  await page.getByRole("link",{name:/Этап 4/}).click();
  await expect(page.getByRole("heading",{name:"Курсовые"})).toBeVisible();
});
test("schedule edits preserve revisions and notify the student",async({page,browser})=>{
  const groupId=key("ИТ-201");
  const original=await db.scheduleEvent.findFirstOrThrow({where:{groupId,start:{gt:new Date()},cancelled:false},orderBy:{start:"asc"}});
  const staff=await browser.newPage();
  try {
    await login(staff,"staff","LevelUpStaff1!");
    await expect(staff).toHaveURL(/\/staff$/);
    await staff.goto("/staff/academic");
    const event=staff.locator("details").filter({has:staff.locator('input[name="id"][value="'+original.id+'"]')});
    await event.locator("summary").click();
    await event.getByLabel("Изменение").selectOption("teacher");
    await event.getByLabel("Преподаватель").fill("Е. И. Тестова");
    await event.getByLabel("Причина изменения").fill("Проверка замены преподавателя");
    await event.getByRole("button",{name:"Сохранить изменение"}).click();
    await expect.poll(async()=> (await db.scheduleEvent.findUnique({where:{id:original.id}}))?.teacherOverride).toBe("Е. И. Тестова");
    await login(page);
    await expect(page).toHaveURL(/dashboard$/);
    await page.goto("/notifications?type=SCHEDULE");
    const notification=page.locator("article").filter({hasText:"Проверка замены преподавателя"});
    await expect(notification.getByText("Заменён преподаватель")).toBeVisible();
    await notification.getByRole("link",{name:"Открыть"}).click();
    const lesson=page.locator("article").filter({hasText:"Е. И. Тестова"});
    await expect(lesson).toBeVisible();
    await lesson.getByText("История изменений").click();
    await expect(lesson.getByText(/Преподаватель: .* → Е. И. Тестова/)).toBeVisible();
  } finally {
    await staff.close();
    const edits=await db.scheduleChange.findMany({where:{eventId:original.id,reason:"Проверка замены преподавателя"}});
    await db.$transaction([
      db.notification.deleteMany({where:{eventKey:{in:edits.map(edit=>"schedule:"+edit.id)}}}),
      db.scheduleChange.deleteMany({where:{id:{in:edits.map(edit=>edit.id)}}}),
      db.scheduleEvent.update({where:{id:original.id},data:{teacherOverride:original.teacherOverride,note:original.note,revision:original.revision}}),
    ]);
  }
});
