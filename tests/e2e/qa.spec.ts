import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { addDays, dayKey, timeLabel } from "../../src/lib/dates";
import { levelFor } from "../../src/lib/rules";

const db = new PrismaClient();
const users = {
  student1: { password: "LevelUpDemo1!", name: "Алексей Лаврин", group: "ИТ-201", subject: "Базы данных", otherSubject: "Типографика", otherName: "Марина Ветрова" },
  student2: { password: "LevelUpDemo2!", name: "Марина Ветрова", group: "ДИЗ-301", subject: "Типографика", otherSubject: "Базы данных", otherName: "Алексей Лаврин" },
  staff: { password: "LevelUpStaff1!" },
};
function key(label: string) {
  const hash = createHash("sha256").update("level-up:" + label).digest("hex");
  return hash.slice(0,8)+"-"+hash.slice(8,12)+"-4"+hash.slice(13,16)+"-8"+hash.slice(17,20)+"-"+hash.slice(20,32);
}
async function login(page: Page, account: keyof typeof users) {
  await page.goto("/login");
  await page.locator('input[name="login"]').fill(account);
  await page.locator('input[name="password"]').fill(users[account].password);
  await page.getByRole("button", {name:"Войти в кабинет"}).click();
  await expect(page).toHaveURL(account === "staff" ? /\/staff$/ : /\/dashboard$/);
  await expect(page.getByRole("main").locator("h1")).toBeVisible();
}
function nav(page: Page) {
  return page.getByRole("navigation",{name:"Основное меню"});
}
test.afterAll(() => db.$disconnect());

test("Auth.js failure returns to the branded login screen", async ({page}) => {
  await page.goto("/api/auth/error?error=Configuration");
  await expect(page).toHaveURL(/\/login\?error=Configuration$/);
  await expect(page.getByRole("alert").filter({hasText:"Вход временно недоступен"})).toBeVisible();
  await page.getByRole("button",{name:"Показать пароль"}).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type","text");
  await page.getByRole("button",{name:"Скрыть пароль"}).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type","password");
});

test("credential forms do not submit passwords without client JavaScript", async ({browser}) => {
  const context = await browser.newContext({javaScriptEnabled:false});
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.locator("form.login-fields")).toHaveAttribute("method","post");
    await expect(page.getByRole("button",{name:"Войти в кабинет"})).toBeDisabled();
  } finally { await context.close(); }
});

test("successful logins release source capacity and failed passwords remain rate limited", async ({page}) => {
  const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
  const source=hash("source:local"), account=hash("login:student1");
  const previous=await db.loginAttempt.findMany({where:{key:{in:[source,account]}}});
  const expiresAt=new Date(Date.now()+900_000);
  try {
    await db.loginAttempt.deleteMany({where:{key:{in:[source,account]}}});
    await db.loginAttempt.create({data:{key:source,count:39,expiresAt}});
    for(let attempt=0;attempt<2;attempt++) {
      await login(page,"student1");
      await page.goto("/profile");
      await page.getByRole("button",{name:"Выйти из аккаунта"}).click();
      await expect(page).toHaveURL(/\/login$/);
    }
    expect((await db.loginAttempt.findUniqueOrThrow({where:{key:source}})).count).toBe(39);
    await db.loginAttempt.update({where:{key:source},data:{count:0}});
    await db.loginAttempt.create({data:{key:account,count:8,expiresAt}});
    await page.locator('input[name="login"]').fill("student1");
    await page.locator('input[name="password"]').fill(users.student1.password);
    await page.getByRole("button",{name:"Войти в кабинет"}).click();
    await expect(page.getByRole("alert").filter({hasText:"превышен лимит"})).toBeVisible();
  } finally {
    await db.loginAttempt.deleteMany({where:{key:{in:[source,account]}}});
    await db.loginAttempt.createMany({data:previous});
  }
});

for (const account of ["student1","student2"] as const) {
  test(account + " follows every student navigation section with isolated records", async ({page}) => {
    const fixture = users[account], other = account==="student1"?"student2":"student1";
    await login(page,account);
    const main = page.getByRole("main");
    await main.getByRole("link",{name:"Открыть карту семестра"}).click();
    const continueStage=main.getByRole("link",{name:/Перейти к этапу/});
    if(await continueStage.count()){
      const target=await continueStage.getAttribute("href");
      await continueStage.click();
      await expect(page).toHaveURL(url=>url.pathname===target);
      await main.getByRole("link",{name:"К карте семестра"}).click();
    }
    for (let stage=1;stage<=6;stage++) {
      await main.locator('.map-step[href="/semester-map/'+stage+'"]').click();
      await expect(page).toHaveURL(new RegExp("/semester-map/"+stage+"$"));
      await expect(main.getByRole("heading",{name:"Контрольные точки"})).toBeVisible();
      await main.getByRole("link",{name:"К карте семестра"}).click();
      await expect(main.getByRole("heading",{name:"Карта семестра",exact:true})).toBeVisible();
    }
    await nav(page).getByRole("link",{name:"Квесты"}).click();
    for (const filter of ["Активные","Ближайшие","Завершённые","Просроченные"]) {
      await main.getByRole("link",{name:filter,exact:true}).click();
      await expect(main.getByRole("link",{name:filter,exact:true})).toHaveAttribute("aria-current","page");
    }
    await main.getByLabel("Дисциплина").selectOption({label:fixture.subject});
    await main.getByLabel("Срок").selectOption("desc");
    await main.getByRole("button",{name:"Применить"}).click();
    await expect(page).toHaveURL(/sort=desc/);
    await expect(main.getByLabel("Срок")).toHaveValue("desc");
    await page.goto("/quests/"+key(key(other)+"personal0"));
    await expect(page.getByRole("heading",{name:"Страница недоступна"})).toBeVisible();
    await page.goto("/dashboard");
    await nav(page).getByRole("link",{name:"Расписание"}).click();
    await main.getByRole("link",{name:"Неделя",exact:true}).click();
    await expect(main.locator(".schedule-day")).toHaveCount(7);
    await main.getByRole("link",{name:"Вперёд"}).click();
    await main.getByRole("link",{name:"Назад"}).click();
    await main.getByRole("link",{name:"Сегодня"}).click();
    await main.getByRole("navigation",{name:"Дни недели"}).getByRole("link").first().click();
    await expect(main.locator(".schedule-day")).toHaveCount(1);
    await expect(main.getByText(fixture.otherSubject,{exact:true})).toHaveCount(0);
    await nav(page).getByRole("link",{name:"Успеваемость"}).click();
    await main.locator("summary").getByText(fixture.subject,{exact:true}).click();
    await expect(main.locator("details[open]").getByText(/баллов/).first()).toBeVisible();
    await expect(main.getByText(fixture.otherSubject,{exact:true})).toHaveCount(0);
    await nav(page).getByRole("link",{name:"Достижения"}).click();
    await expect(main.locator(".achievement")).toHaveCount(6);
    await nav(page).getByRole("link",{name:"Заявки и справки"}).click();
    await main.getByRole("link",{name:"Новая заявка"}).click();
    await main.getByRole("link",{name:"К заявкам"}).click();
    await page.goto("/documents/"+key(key(other)+"document"));
    await expect(page.getByRole("heading",{name:"Страница недоступна"})).toBeVisible();
    await page.goto("/dashboard");
    await nav(page).getByRole("link",{name:"Уведомления"}).click();
    await main.getByLabel("Категория").selectOption("ANNOUNCEMENT");
    await main.getByRole("button",{name:"Применить"}).click();
    await expect(main.getByText(account==="student1"?"График зимней сессии":"Просмотр учебных проектов")).toBeVisible();
    await expect(main.getByText(account==="student2"?"График зимней сессии":"Просмотр учебных проектов")).toHaveCount(0);
    await nav(page).getByRole("link",{name:"Профиль"}).click();
    await expect(main.getByRole("heading",{name:fixture.name})).toBeVisible();
    await expect(main.getByText(fixture.otherName,{exact:true})).toHaveCount(0);
  });
}

test("schedule navigation handles date boundaries without a server error", async ({page}) => {
  await login(page,"student1");
  for (const day of ["0000-01-01","9999-12-31","2026-02-30"]) {
    await page.goto("/schedule?view=week&day="+day);
    await expect(page.getByRole("heading",{name:"Расписание",exact:true})).toBeVisible();
    await expect(page.locator(".schedule-day")).toHaveCount(7);
  }
});

test("expired personal quest never offers XP and preserves completion", async ({page}) => {
  const studentId=key("student2"), questId=key(studentId+"personal3");
  await db.quest.update({where:{id:questId},data:{due:new Date(Date.now()-60_000)}});
  await db.questCompletion.deleteMany({where:{questId}});
  await login(page,"student2");
  await page.goto("/quests/"+questId);
  await expect(page.getByText("0 XP",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Отметить выполненным"}).click();
  await expect.poll(()=>db.questCompletion.count({where:{questId}})).toBe(1);
  await page.reload();
  await expect(page.getByText(/Выполнен \d/)).toBeVisible();
  expect(await db.xpEvent.count({where:{studentId,eventKey:"quest:"+questId}})).toBe(0);
});

test("closing the final checkpoint grants stage, credit and semester XP while grades stay unchanged", async ({page,browser}) => {
  const studentId=key("student2"), staff=await browser.newPage();
  const quest=await db.quest.findUniqueOrThrow({where:{id:key(studentId+"academic18")},include:{assessment:true}});
  const assessment=quest.assessment!;
  const now=new Date();
  const passed=await db.assessment.findMany({where:{enrollment:{studentId},passedAt:null,id:{not:assessment.id}}});
  const grades=()=>db.grade.findMany({where:{enrollment:{studentId}},orderBy:{id:"asc"}});
  try {
    await db.assessment.updateMany({where:{id:{in:passed.map(item=>item.id)}},data:{passedAt:now}});
    const originalGrades=await grades();
    await login(staff,"staff");
    await staff.goto("/staff/academic");
    const checkpoint=staff.locator("details").filter({has:staff.locator('input[name="id"][value="'+assessment.id+'"]')});
    await checkpoint.locator("summary").click();
    await checkpoint.getByRole("button",{name:"Подтвердить выполнение"}).click();
    await expect.poll(()=>db.xpEvent.count({where:{studentId,kind:"SEMESTER"}})).toBe(1);
    const events=await db.xpEvent.findMany({where:{studentId}});
    expect(events.find(row=>row.eventKey==="quest:"+quest.id)?.amount).toBe(200);
    expect(events.find(row=>row.eventKey==="stage:"+assessment.stageId)?.amount).toBe(150);
    expect(events.find(row=>row.kind==="SEMESTER")?.amount).toBe(500);
    expect(await grades()).toEqual(originalGrades);
    await login(page,"student2");
    await expect(page.getByRole("progressbar",{name:"Прогресс семестра"})).toHaveAttribute("aria-valuenow","100");
    const level=levelFor(events.reduce((sum,row)=>sum+row.amount,0)).level;
    await expect(page.getByRole("heading",{name:"Уровень "+level})).toBeVisible();
    await nav(page).getByRole("link",{name:"Достижения"}).click();
    await expect(page.locator("article").filter({hasText:"Финишная прямая"}).getByText(/Получено/)).toBeVisible();
  } finally {
    await staff.close();
    const ids=[...passed.map(item=>item.id),assessment.id];
    const linked=await db.quest.findMany({where:{assessmentId:{in:ids}},select:{id:true}});
    const stageIds=[...new Set([...passed.map(item=>item.stageId),assessment.stageId])];
    const earned=await db.studentAchievement.findMany({where:{studentId,earnedAt:{gte:now}}});
    await db.$transaction([
      db.notification.deleteMany({where:{userId:studentId,eventKey:{in:[...earned.map(row=>"achievement:"+row.achievementId),"assessment:"+assessment.id]}}}),
      db.studentAchievement.deleteMany({where:{studentId,earnedAt:{gte:now}}}),
      db.auditLog.deleteMany({where:{targetId:assessment.id,createdAt:{gte:now}}}),
      db.questCompletion.deleteMany({where:{questId:{in:linked.map(row=>row.id)}}}),
      db.studentSemesterProgress.deleteMany({where:{studentId,stageId:{in:stageIds}}}),
      db.xpEvent.deleteMany({where:{studentId,OR:[{kind:"SEMESTER"},{eventKey:{in:[...linked.map(row=>"quest:"+row.id),...stageIds.map(id=>"stage:"+id)]}}]}}),
      db.assessment.updateMany({where:{id:{in:ids}},data:{passedAt:null}}),
    ]);
  }
});

test("profile settings and single/all notification reads persist per student", async ({page}) => {
  const studentId=key("student2"), otherId=key("student1");
  const previous=await db.studentProfile.findUniqueOrThrow({where:{userId:studentId}});
  const own=await db.notification.create({data:{userId:studentId,type:"GRADE",title:"QA: личное уведомление",body:"Тест"}});
  const second=await db.notification.create({data:{userId:studentId,type:"GRADE",title:"QA: второе уведомление",body:"Тест"}});
  const other=await db.notification.create({data:{userId:otherId,type:"GRADE",title:"QA: чужое уведомление",body:"Тест"}});
  try {
    await login(page,"student2");
    await nav(page).getByRole("link",{name:"Профиль"}).click();
    await page.getByLabel("Тема").selectOption("light");
    await page.getByLabel("Напоминания о дедлайнах").uncheck();
    await page.getByLabel("Игровые анимации").uncheck();
    await page.getByRole("button",{name:"Сохранить настройки"}).click();
    await expect.poll(async()=> (await db.studentProfile.findUniqueOrThrow({where:{userId:studentId}})).theme).toBe("light");
    await page.reload();
    await expect(page.locator(".shell")).toHaveAttribute("data-theme","light");
    await expect(page.locator(".shell")).toHaveAttribute("data-motion","off");
    await expect(page.getByLabel("Напоминания о дедлайнах")).not.toBeChecked();
    await page.locator(".bell").click();
    await expect(page.getByText(other.title)).toHaveCount(0);
    await page.getByRole("button",{name:"Прочитано: "+own.title}).click();
    await expect.poll(async()=>Boolean((await db.notification.findUnique({where:{id:own.id}}))?.readAt)).toBe(true);
    await page.reload();
    await page.getByRole("button",{name:"Прочитать все"}).click();
    await expect.poll(()=>db.notification.count({where:{userId:studentId,readAt:null}})).toBe(0);
    expect((await db.notification.findUniqueOrThrow({where:{id:other.id}})).readAt).toBeNull();
  } finally {
    await db.notification.deleteMany({where:{id:{in:[own.id,second.id,other.id]}}});
    await db.studentProfile.update({where:{userId:studentId},data:{theme:previous.theme,animations:previous.animations,reminders:previous.reminders}});
  }
});

test("documents enforce ownership and preserve an already submitted version", async ({page,baseURL}) => {
  const owner=key("student2"),id=randomUUID();
  const fields={id,type:"OTHER",recipient:"Учебный отдел",details:"QA исходное обращение",intent:"submit",delivery:"PICKUP",contactEmail:"student2@example.test",confirmed:"yes"};
  await db.documentRequest.create({data:{id,studentId:owner,type:"OTHER",recipient:fields.recipient,details:fields.details,status:"SUBMITTED",delivery:"PICKUP",contactEmail:fields.contactEmail}});
  const post=(data:typeof fields) => page.request.post("/api/documents",{form:data,headers:{origin:new URL(baseURL!).origin}});
  try {
    await login(page,"student1");
    expect((await page.request.post("/api/documents",{form:fields,headers:{origin:"https://invalid.example"}})).status()).toBe(403);
    expect((await post({...fields,details:"QA недоступное изменение"})).status()).toBe(404);
    await page.goto("/profile");
    await page.getByRole("button",{name:"Выйти из аккаунта"}).click();
    await expect(page).toHaveURL(/\/login$/);
    await login(page,"student2");
    expect((await post(fields)).status()).toBe(200);
    expect((await post({...fields,details:"QA версия после отправки"})).status()).toBe(409);
    expect((await db.documentRequest.findUniqueOrThrow({where:{id}})).details).toBe(fields.details);
  } finally { await db.documentRequest.delete({where:{id}}); }
});

test("staff documents follow approval, ready and rejection paths while drafts stay private", async ({page,browser}) => {
  const owner=key("student2"),student=await browser.newPage();
  const draftId=randomUUID(), approveId=randomUUID(), rejectId=randomUUID();
  const fixtures=[{id:draftId,status:"DRAFT"},{id:approveId,status:"SUBMITTED"},{id:rejectId,status:"SUBMITTED"}] as const;
  await db.documentRequest.createMany({data:fixtures.map(f=>({...f,studentId:owner,type:"CERTIFICATE",recipient:"Учебный отдел",details:"QA "+f.id}))});
  async function advance(id:string,status:"REVIEW"|"APPROVED"|"READY"|"REJECTED",comment:string) {
    await page.goto("/staff/"+id);
    await page.getByLabel("Новый статус").selectOption(status);
    await page.getByLabel("Комментарий").fill(comment);
    await page.getByRole("button",{name:"Обновить статус"}).click();
  }
  try {
    await login(page,"staff");
    await expect(page.getByRole("link",{name:/Марина Ветрова/}).first()).toBeVisible();
    await page.goto("/staff/"+draftId);
    await expect(page.getByRole("heading",{name:"Страница недоступна"})).toBeVisible();
    for (const [id,status,comment] of [[approveId,"REVIEW","Взято в работу"],[approveId,"APPROVED","Согласовано"],[approveId,"READY","Можно получить"],[rejectId,"REVIEW","Проверка"]] as const) {
      await advance(id,status,comment);
      await expect.poll(async()=> (await db.documentRequest.findUniqueOrThrow({where:{id}})).status).toBe(status);
    }
    await advance(rejectId,"REJECTED","");
    await expect(page.getByRole("alert").filter({hasText:"Укажите причину отклонения"})).toBeVisible();
    await advance(rejectId,"REJECTED","Нужны уточнения");
    await expect.poll(async()=> (await db.documentRequest.findUniqueOrThrow({where:{id:rejectId}})).status).toBe("REJECTED");
    await login(student,"student2");
    await student.goto("/documents/"+approveId);
    await expect(student.getByText("Можно получить")).toBeVisible();
    await student.goto("/documents/"+rejectId);
    await expect(student.getByText("Нужны уточнения")).toBeVisible();
    expect(await db.auditLog.count({where:{targetId:{in:[approveId,rejectId]}}})).toBe(5);
  } finally {
    await student.close();
    const ids=fixtures.map(f=>f.id);
    await db.notification.deleteMany({where:{href:{in:ids.map(id=>"/documents/"+id)}}});
    await db.auditLog.deleteMany({where:{targetId:{in:ids}}});
    await db.documentRequest.deleteMany({where:{id:{in:ids}}});
  }
});

test("mobile menu, skip link, profile shortcut and staff logout reach their targets", async ({page}) => {
  await page.setViewportSize({width:360,height:800});
  await login(page,"student2");
  await page.getByRole("link",{name:"К содержимому"}).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const mobile=page.getByRole("navigation",{name:"Мобильное меню"});
  for (const [label,path] of [["Расписание","schedule"],["Квесты","quests"],["Заявки","documents"],["Главная","dashboard"]]) {
    await mobile.getByRole("link",{name:label,exact:true}).click();
    await expect(page).toHaveURL(new RegExp("/"+path+"$"));
  }
  await mobile.getByText("Меню",{exact:true}).click();
  await mobile.getByRole("link",{name:"Карта семестра"}).click();
  await expect(page).toHaveURL(/\/semester-map$/);
  await expect(mobile.locator("details")).not.toHaveAttribute("open","");
  await page.getByRole("link",{name:"Открыть профиль"}).click();
  await page.getByRole("button",{name:"Выйти из аккаунта"}).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page,"staff");
  await mobile.getByRole("link",{name:"Учебные данные"}).click();
  await expect(page).toHaveURL(/\/staff\/academic$/);
  await mobile.getByText("Меню",{exact:true}).click();
  await mobile.getByRole("button",{name:"Выйти",exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("staff can change room, reschedule and cancel with a trace visible to the student", async ({page,browser}) => {
  const groupId=key("ИТ-201"), source=await db.scheduleEvent.findFirstOrThrow({where:{groupId,format:"Онлайн"}});
  const target=await db.scheduleEvent.create({data:{groupId,subjectId:source.subjectId,kind:"QA занятие",start:new Date(Date.now()+60_000),end:new Date(Date.now()+3_600_000),room:"Онлайн",format:"Онлайн"}});
  const student=await browser.newPage();
  const reason="QA "+target.id;
  const form=page.locator("details").filter({has:page.locator('input[name="id"][value="'+target.id+'"]')});
  async function openEdit() {
    await expect(page.getByRole("heading",{name:"Учебные данные",exact:true})).toBeVisible();
    await form.locator("summary").click();
  }
  async function save(reloads=false) {
    await form.getByLabel("Причина изменения").fill(reason);
    const click=()=>form.getByRole("button",{name:"Сохранить изменение"}).click();
    if(reloads) await Promise.all([page.waitForEvent("domcontentloaded"),click()]);
    else await click();
  }
  try {
    await login(page,"staff");
    await nav(page).getByRole("link",{name:"Учебные данные"}).click();
    await openEdit();
    await form.getByLabel("Корпус").fill("Корпус QA");
    await form.getByLabel("Аудитория",{exact:true}).fill("QA-101");
    await save(true);
    await expect.poll(async()=> (await db.scheduleEvent.findUniqueOrThrow({where:{id:target.id}})).room).toBe("QA-101");
    expect((await db.scheduleEvent.findUniqueOrThrow({where:{id:target.id}})).format).toBe("Очно");
    await openEdit();
    await form.getByLabel("Изменение").selectOption("time");
    const day=addDays(dayKey(new Date()),2);
    await form.getByLabel("Новое начало").fill(day+"T11:00");
    await form.getByLabel("Новое окончание").fill(day+"T10:00");
    await save();
    await expect(form.getByRole("alert")).toHaveText("Укажите корректное время начала и окончания.");
    await form.getByLabel("Новое начало").fill(day+"T11:00");
    await form.getByLabel("Новое окончание").fill(day+"T12:00");
    await save(true);
    await expect.poll(async()=>dayKey((await db.scheduleEvent.findUniqueOrThrow({where:{id:target.id}})).start)).toBe(day);
    expect(timeLabel((await db.scheduleEvent.findUniqueOrThrow({where:{id:target.id}})).start)).toBe("11:00");
    await openEdit();
    await form.getByLabel("Изменение").selectOption("cancel");
    await save(true);
    await expect.poll(async()=> (await db.scheduleEvent.findUniqueOrThrow({where:{id:target.id}})).cancelled).toBe(true);
    await login(student,"student1");
    await student.goto("/schedule?day="+day);
    const lesson=student.locator("article").filter({hasText:"QA занятие"});
    await expect(lesson.getByText("Отменено",{exact:true})).toBeVisible();
    await lesson.getByText("История изменений").click();
    await expect(lesson.getByText(/Аудитория: Онлайн → QA-101/)).toBeVisible();
    await expect(lesson.getByText(/Время: .* → /)).toBeVisible();
    expect(await db.auditLog.count({where:{targetId:target.id}})).toBe(3);
  } finally {
    await student.close();
    await db.notification.deleteMany({where:{body:{contains:reason}}});
    await db.auditLog.deleteMany({where:{targetId:target.id}});
    await db.scheduleEvent.delete({where:{id:target.id}});
  }
});
