import { expect,test,type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { randomUUID } from "node:crypto";
import { addDays,dayKey,fromLocal } from "../../src/lib/dates";
import type { Activity } from "../../src/lib/course-data";

const db=new PrismaClient();
test.afterAll(()=>db.$disconnect());

async function login(page:Page,role:"student1"|"student2"|"teacher1") {
  await page.goto("/login");
  await page.locator('[name="login"]').fill(role);
  await page.locator('[name="password"]').fill({student1:"LevelUpDemo1!",student2:"LevelUpDemo2!",teacher1:"LevelUpTeacher1!"}[role]);
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
  await expect(page).toHaveURL(role==="teacher1"?/\/teacher$/:/\/dashboard$/);
}

test("an identical booking retry succeeds and distinct students cannot reserve one slot",async({page,browser,baseURL})=>{
  const [teacher,student2]=await Promise.all([db.user.findUniqueOrThrow({where:{login:"teacher1"}}),db.user.findUniqueOrThrow({where:{login:"student2"}})]);
  const subject=await db.subject.findFirstOrThrow({where:{instructorId:teacher.id,enrollments:{some:{student:{user:{login:"student1"}}}}}});
  const enrollment=await db.enrollment.create({data:{subjectId:subject.id,studentId:student2.id}});
  const date=addDays(dayKey(new Date()),61);
  const slots=await Promise.all(["09","10"].map(hour=>db.consultationSlot.create({data:{teacherId:teacher.id,format:"IN_PERSON",location:"А-201",
    startsAt:fromLocal(`${date}T${hour}:00`)!,endsAt:fromLocal(`${date}T${hour}:30`)!}})));
  const other=await browser.newPage(),origin=new URL(baseURL!).origin;
  const post=(tab:Page,data:object)=>tab.request.post("/api/academic-planning",{headers:{origin},data});
  try {
    await login(page,"student1");
    const base={operation:"book",topic:"Уточнение условий работы",comment:""};
    const request={...base,id:randomUUID(),slotId:slots[0].id};
    const retries=await Promise.all(Array.from({length:4},()=>post(page,request)));
    expect(retries.map(response=>response.status())).toEqual([200,200,200,200]);
    expect(await db.consultationBooking.count({where:{slotId:slots[0].id}})).toBe(1);
    await login(other,"student2");
    const competing=await Promise.all([page,other].map(tab=>post(tab,{...base,id:randomUUID(),slotId:slots[1].id})));
    expect(competing.map(response=>response.status()).sort()).toEqual([200,409]);
    expect(await db.consultationBooking.count({where:{slotId:slots[1].id}})).toBe(1);
  } finally {
    await other.close();
    await db.consultationBooking.deleteMany({where:{slotId:{in:slots.map(slot=>slot.id)}}});
    await db.consultationSlot.deleteMany({where:{id:{in:slots.map(slot=>slot.id)}}});
    await db.enrollment.delete({where:{id:enrollment.id}});
  }
});

test("completing a consultation keeps the meeting in the student's calendar",async({page,browser})=>{
  const [teacher,student]=await Promise.all([db.user.findUniqueOrThrow({where:{login:"teacher1"}}),db.user.findUniqueOrThrow({where:{login:"student1"}})]);
  const date=addDays(dayKey(new Date()),-7),topic=`Проведённая консультация ${randomUUID().slice(0,8)}`;
  const slot=await db.consultationSlot.create({data:{teacherId:teacher.id,format:"IN_PERSON",location:"А-204",
    startsAt:fromLocal(`${date}T14:00`)!,endsAt:fromLocal(`${date}T14:30`)!}});
  const booking=await db.consultationBooking.create({data:{studentId:student.id,slotId:slot.id,status:"CONFIRMED",topic,comment:""}});
  const teacherPage=await browser.newPage();
  try {
    await login(page,"student1");
    const day=`/calendar?view=day&day=${date}`;
    const event=page.locator("article").filter({hasText:topic});
    await page.goto(day);
    await expect(event).toBeVisible();
    await login(teacherPage,"teacher1");
    await teacherPage.goto("/teacher/consultations");
    const card=teacherPage.locator("article").filter({hasText:topic});
    await card.getByRole("button",{name:"Завершить",exact:true}).click();
    await expect(card.getByText("Завершена",{exact:true})).toBeVisible();
    await page.reload();
    await expect(event).toBeVisible({timeout:5000});
    await expect(event).toContainText("Завершена");
  } finally {
    await teacherPage.close();
    await db.notification.deleteMany({where:{userId:student.id,body:topic}});
    await db.auditLog.deleteMany({where:{targetId:booking.id}});
    await db.consultationBooking.delete({where:{id:booking.id}});
    await db.consultationSlot.delete({where:{id:slot.id}});
  }
});

test("find a teacher, validate the form, reject an in-person request and cancel an online request",async({page,browser})=>{
  const teacher=await db.user.findUniqueOrThrow({where:{login:"teacher1"},include:{teacherProfile:true}});
  const date=addDays(dayKey(new Date()),60);
  const token=randomUUID().slice(0,8),inPerson=`Очная консультация ${token}`,online=`Онлайн-консультация ${token}`;
  const existing=await db.consultationSlot.findMany({where:{teacherId:teacher.id,closed:false,startsAt:{gt:new Date()}},select:{id:true}});
  await db.consultationSlot.updateMany({where:{id:{in:existing.map(item=>item.id)}},data:{closed:true}});
  const staff=await browser.newPage();
  const slots:string[]=[];
  try {
    await login(page,"student1");
    await page.goto("/teachers");
    await page.getByLabel("Поиск").fill("Базы данных");
    await page.getByRole("button",{name:"Найти"}).click();
    const result=page.locator("article.teacher-card").filter({hasText:teacher.name});
    await expect(result.getByText("Нет свободных слотов")).toBeVisible();
    await result.getByRole("link",{name:"Подробнее"}).click();
    await expect(page.getByText("Свободных слотов пока нет",{exact:true})).toBeVisible();
    for(const [format,hour,location] of [["IN_PERSON","10","А-201"],["ONLINE","11","https://example.test/consultation"]] as const) {
      slots.push((await db.consultationSlot.create({data:{teacherId:teacher.id,format,location,
        startsAt:fromLocal(`${date}T${hour}:00`)!,endsAt:fromLocal(`${date}T${hour}:30`)!}})).id);
    }
    await page.reload();
    await expect(page.getByText(teacher.teacherProfile!.department)).toBeVisible();
    await expect(page.getByText(teacher.teacherProfile!.receptionHours)).toBeVisible();
    const send=page.getByRole("button",{name:"Отправить заявку на консультацию"});
    await send.click();
    expect(await page.getByLabel("Тема консультации").evaluate(input=>(input as HTMLInputElement).validity.valueMissing)).toBe(true);
    expect(await db.consultationBooking.count({where:{slotId:{in:slots}}})).toBe(0);
    await page.getByLabel("Формат",{exact:true}).selectOption("IN_PERSON");
    await page.getByLabel("Тема консультации").fill(inPerson);
    await send.click();
    await expect(page).toHaveURL(/consultations$/);
    await login(staff,"teacher1");
    await staff.goto("/teacher/consultations");
    const request=staff.locator("article").filter({hasText:inPerson});
    await request.getByRole("button",{name:"Отклонить",exact:true}).click();
    await expect(request).toContainText("Отклонена");
    await page.goto(`/teachers/${teacher.id}`);
    await page.getByLabel("Формат",{exact:true}).selectOption("ONLINE");
    await page.getByLabel("Тема консультации").fill(online);
    await send.click();
    await expect(page).toHaveURL(/consultations$/);
    const onlineCard=page.locator("article").filter({hasText:online});
    await expect(onlineCard.getByRole("link",{name:"Открыть ссылку встречи"})).toHaveCount(0);
    await onlineCard.getByRole("button",{name:"Отменить",exact:true}).click();
    await expect(onlineCard).toContainText("Отменена");
  } finally {
    await staff.close();
    await db.notification.deleteMany({where:{body:{in:[inPerson,online]}}});
    const bookings=await db.consultationBooking.findMany({where:{slotId:{in:slots}},select:{id:true}});
    await db.auditLog.deleteMany({where:{targetId:{in:bookings.map(item=>item.id)}}});
    await db.consultationBooking.deleteMany({where:{slotId:{in:slots}}});
    await db.consultationSlot.deleteMany({where:{id:{in:slots}}});
    await db.consultationSlot.updateMany({where:{id:{in:existing.map(item=>item.id)}},data:{closed:false}});
  }
});

test("dashboard opens the nearest published checkpoint and carries it into the simulator",async({page})=>{
  const [teacher,student]=await Promise.all([db.user.findUniqueOrThrow({where:{login:"teacher1"}}),db.user.findUniqueOrThrow({where:{login:"student1"}})]);
  const subject=await db.subject.create({data:{title:`QA маршрут ${randomUUID().slice(0,8)}`,teacher:teacher.name,instructorId:teacher.id,credits:2,color:"violet",
    enrollments:{create:{studentId:student.id}}},include:{enrollments:true}});
  const activity:Activity={id:randomUUID(),title:"Ближайшая проверочная работа",kind:"CONTROL",startsAt:new Date(Date.now()+5*60000).toISOString(),
    place:"А-205",format:"Очно",description:"Решите задачу",topics:"Правила курса",requirements:"Опишите ход решения",max:10,weight:2,materials:"",optional:false,registration:false};
  const other={...activity,id:randomUUID(),title:"Следующая работа",startsAt:new Date(Date.now()+3600000).toISOString(),max:5,weight:1};
  const plan={title:subject.title,period:"Демо",rule:{cap:30,bonus:0,rounding:"NEAREST",pass:10,good:20,excellent:28},activities:[other,activity]};
  await db.coursePlan.create({data:{subjectId:subject.id,draft:plan,versions:{create:{number:1,data:plan,authorId:teacher.id,reason:"Проверка маршрута"}}}});
  try {
    await login(page,"student1");
    const checkpoint=page.getByRole("link",{name:new RegExp(activity.title)});
    await expect(checkpoint).toBeVisible({timeout:5000});
    await checkpoint.click();
    await expect(page.getByText("Опишите ход решения")).toBeVisible();
    await expect(page.getByText("До 20 баллов рейтинга за работу с учётом веса.")).toBeVisible();
    await expect(page.getByRole("link",{name:"Записаться к преподавателю"})).toHaveAttribute("href",`/teachers/${teacher.id}#booking`);
    await page.getByRole("link",{name:"Рассчитать результат"}).click();
    await expect(page.getByLabel("Мероприятие")).toHaveValue(activity.id);
    const input=page.getByLabel("Предполагаемый балл");
    for(const [value,score] of [["0",0],["1",2],["10",20],["11",20],["-1",0]] as const) {
      await input.fill(value);
      await expect(page.getByText(new RegExp(`Прогноз: ${score} баллов`))).toBeVisible();
    }
    await page.getByLabel("Целевой результат").fill("28");
    await expect(page.getByText(/Цель недостижима.*25 баллов/)).toBeVisible();
    expect(await db.courseResult.count({where:{enrollment:{subjectId:subject.id}}})).toBe(0);
  } finally {
    await db.notification.deleteMany({where:{userId:student.id,href:{contains:subject.id}}});
    await db.enrollment.deleteMany({where:{subjectId:subject.id}});
  }
});

test("expired and logged-out sessions cannot read protected routes, and user selectors do not change ownership",async({page,baseURL,browser})=>{
  const other=await db.user.findUniqueOrThrow({where:{login:"student2"}});
  await login(page,"student1");
  for(const path of [`/profile?studentId=${other.id}`,`/grades?studentId=${other.id}`]) {
    await page.goto(path);
    await expect(page.getByText(other.name,{exact:true})).toHaveCount(0);
  }
  await expect(page.getByText("Типографика",{exact:true})).toHaveCount(0);
  const cookie=(await page.context().cookies()).find(item=>item.name.endsWith("authjs.session-token"))!;
  expect(cookie).toMatchObject({httpOnly:true,sameSite:"Lax"});
  const expired=await encode({secret:process.env.AUTH_SECRET!,salt:cookie.name,token:{sub:other.id,role:"STUDENT"},maxAge:-120});
  const closed=await browser.newContext({baseURL});
  try {
    await closed.addCookies([{name:cookie.name,value:expired,url:new URL(baseURL!).origin}]);
    const rejected=await closed.request.get("/profile",{maxRedirects:0});
    expect(rejected.status()).toBe(307);
    expect(rejected.headers().location).toMatch(/\/login$/);
    expect(await rejected.text()).not.toContain(other.name);
  } finally {await closed.close();}
  await page.goto("/profile");
  await page.getByRole("button",{name:"Выйти из аккаунта"}).click();
  await expect(page).toHaveURL(/\/login$/);
  const denied=await page.request.get("/grades",{maxRedirects:0});
  expect(denied.status()).toBe(307);
  expect(denied.headers().location).toMatch(/\/login$/);
  expect(await denied.text()).not.toContain("Алексей Лаврин");
});

test("student requests cannot change official state and oversized messages are rejected",async({page,baseURL})=>{
  const student=await db.user.findUniqueOrThrow({where:{login:"student1"}});
  const enrollment=await db.enrollment.findFirstOrThrow({where:{studentId:student.id,subject:{plan:{isNot:null}}},include:{subject:{include:{plan:true}},assessments:true}});
  const plan=enrollment.subject.plan!,assessment=enrollment.assessments[0];
  const xpBefore=await db.xpEvent.count({where:{studentId:student.id}});
  const origin=new URL(baseURL!).origin,docId=randomUUID();
  const post=(data:object)=>page.request.post("/api/academic-planning",{headers:{origin},data});
  await login(page,"student1");
  expect((await post({operation:"gradebookFinal",subjectId:enrollment.subjectId,rows:[{enrollmentId:enrollment.id,grade:5,expected:enrollment.finalGrade}]})).status()).toBe(403);
  expect((await post({operation:"savePlan",subjectId:enrollment.subjectId,revision:plan.draftRevision,plan:plan.draft,intent:"draft",reason:""})).status()).toBe(403);
  expect((await post({operation:"awardXp",amount:100})).status()).toBe(400);
  expect(await db.xpEvent.count({where:{studentId:student.id}})).toBe(xpBefore);
  expect((await db.enrollment.findUniqueOrThrow({where:{id:enrollment.id}})).finalGrade).toBe(enrollment.finalGrade);
  expect((await db.coursePlan.findUniqueOrThrow({where:{subjectId:enrollment.subjectId}})).draftRevision).toBe(plan.draftRevision);
  const message=await page.request.post("/api/checkpoint-messages",{headers:{origin},data:{id:randomUUID(),assessmentId:assessment.id,body:"а".repeat(11000)}});
  const largePlan=await post({operation:"savePlan",reason:"а".repeat(126000)});
  expect(largePlan.status()).toBe(413);
  try {
    const draft=await page.request.post("/api/documents",{headers:{origin},form:{id:docId,type:"CERTIFICATE",recipient:"Для стипендии",details:"Подтверждение обучения",intent:"draft",status:"APPROVED"}});
    expect(draft.status()).toBe(200);
    expect((await db.documentRequest.findUniqueOrThrow({where:{id:docId}})).status).toBe("DRAFT");
  } finally {await db.documentRequest.deleteMany({where:{id:docId}});}
  expect(message.status()).toBe(413);
});
