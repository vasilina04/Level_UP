import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { addDays, dayKey, fromLocal } from "../../src/lib/dates";
import { parsePlan } from "../../src/lib/course-data";

const db = new PrismaClient();
test.afterAll(() => db.$disconnect());
test.use({ actionTimeout: 15_000 });

async function login(page: Page, username: string, password: string, destination: RegExp) {
  await page.goto("/login");
  await page.locator('[name="login"]').fill(username);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button", { name: "Войти в кабинет" }).click();
  await expect(page).toHaveURL(destination);
}

test("consultation proposals preserve privacy, reserve a slot and update the calendar", async ({ page, browser, baseURL }) => {
  const instructor = await db.user.findUniqueOrThrow({ where: { login: "teacher1" } });
  const id = randomUUID();
  const topic = "План подготовки " + id.slice(0, 8);
  const day = addDays(dayKey(new Date()), 45);
  const origin = new URL(baseURL!).origin;
  const teacher = await browser.newPage();
  const other = await browser.newPage();
  const slots = await Promise.all(["10", "11", "12"].map(hour => db.consultationSlot.create({ data: {
    teacherId: instructor.id, format: "IN_PERSON", location: "А-305",
    startsAt: fromLocal(`${day}T${hour}:00`)!, endsAt: fromLocal(`${day}T${hour}:30`)!,
  } })));
  try {
    await login(page, "student1", "LevelUpDemo1!", /dashboard$/);
    await page.goto(`/teachers/${instructor.id}`);
    await page.getByLabel("Дата", { exact: true }).selectOption(day);
    await page.locator('select[name="slotId"]').selectOption(slots[0].id);
    await page.getByLabel("Тема консультации").fill(topic);
    await page.getByRole("button", { name: "Отправить заявку на консультацию" }).click();
    await expect(page).toHaveURL(/consultations$/);
    const card = page.locator("article").filter({ hasText: topic });
    await expect(card).toContainText("Ожидает подтверждения");
    const post = (context: Page, data: object, requestOrigin = origin) => context.request.post("/api/academic-planning", { headers: { origin: requestOrigin }, data });
    const secondTopic = topic + " · параллельная запись";
    const race = await Promise.all([1, 2].map(() => post(page, { operation: "book", id: randomUUID(), slotId: slots[2].id, topic: secondTopic, comment: "" })));
    expect(race.map(response => response.status()).sort()).toEqual([200, 409]);
    await login(teacher, "teacher1", "LevelUpTeacher1!", /\/teacher$/);
    await teacher.goto("/teacher/consultations");
    const secondCard = teacher.locator("article").filter({ has: teacher.getByRole("heading", { name: secondTopic, exact: true }) });
    await secondCard.getByRole("button", { name: "Подтвердить", exact: true }).click();
    await expect(secondCard).toContainText("Подтверждена");
    const teacherCard = teacher.locator("article").filter({ has: teacher.getByRole("heading", { name: topic, exact: true }) });
    await teacherCard.getByLabel("Другой свободный слот").selectOption(slots[1].id);
    await teacherCard.getByRole("button", { name: "Предложить другое время" }).click();
    await expect(teacherCard).toContainText("Предложено другое время");
    await expect(teacherCard).toContainText("11:00–11:30");
    const booking = await db.consultationBooking.findFirstOrThrow({ where: { topic, slotId: slots[1].id } });
    await login(other, "student2", "LevelUpDemo2!", /dashboard$/);
    await other.goto("/consultations");
    await expect(other.getByText(topic, { exact: true })).toHaveCount(0);
    const cancel = { operation: "bookingStatus", id: booking.id, revision: booking.revision, status: "CANCELLED" };
    expect((await post(other, cancel)).status()).toBe(404);
    expect((await post(other, { operation: "book", id: randomUUID(), slotId: slots[0].id, topic: "Недоступная запись", comment: "" })).status()).toBe(409);
    expect((await post(page, cancel, "https://example.test")).status()).toBe(403);
    await page.goto("/notifications?type=CONSULTATION");
    await expect(page.locator("article").filter({hasText:secondTopic})).toContainText("Подтверждена");
    await expect(page.locator("article").filter({hasText:topic}).filter({hasText:"Предложено другое время"})).toBeVisible();
    await page.goto("/consultations");
    const proposed = card.filter({ has: page.getByRole("heading", { name: topic, exact: true }) });
    await proposed.getByRole("button", { name: "Принять время" }).click();
    await expect(proposed).toContainText("Подтверждена");
    await page.goto(`/calendar?view=day&day=${day}`);
    const event = page.locator("article").filter({ hasText: topic }).filter({ hasText: "11:00" });
    await expect(event).toBeVisible();
  } finally {
    await teacher.close();
    await other.close();
    await db.consultationBooking.deleteMany({ where: { slotId: { in: slots.map(slot => slot.id) } } });
    await db.consultationSlot.deleteMany({ where: { id: { in: slots.map(slot => slot.id) } } });
  }
});

test("a published course stays immutable and its calendar, reminders and results follow the latest version", async ({ page, browser, baseURL }) => {
  const teacherUser = await db.user.findUniqueOrThrow({ where: { login: "teacher1" } });
  const student = await db.user.findUniqueOrThrow({ where: { login: "student1" } });
  const subject = await db.subject.create({ data: { title: `QA: рейтинг ${randomUUID().slice(0, 8)}`, teacher: teacherUser.name, instructorId: teacherUser.id, credits: 3, color: "violet",
    enrollments: { create: { studentId: student.id } },
  }, include: { enrollments: true } });
  const base = `/courses/${subject.id}/map`;
  const editor = `/teacher/courses/${subject.id}`;
  const day = addDays(dayKey(new Date()), 7), moved = addDays(day, 1);
  const title = "Контрольная по тестовому курсу " + subject.id.slice(0, 8);
  const enrollmentId=subject.enrollments[0].id;
  const stage=await db.semesterStage.findUniqueOrThrow({where:{position:4}});
  const point=await db.assessment.create({data:{enrollmentId,stageId:stage.id,title,due:fromLocal(`${day}T09:00`)!}});
  const quest=await db.quest.create({data:{enrollmentId,studentId:student.id,assessmentId:point.id,title,description:"Подготовьте запросы.",due:point.due,kind:"LAB"}});
  const teacher = await browser.newPage();
  const outsider = await browser.newPage();
  try {
    await login(teacher, "teacher1", "LevelUpTeacher1!", /\/teacher$/);
    await teacher.goto(editor);
    await teacher.getByLabel("Учебный период").fill("Тестовый семестр");
    await teacher.getByLabel("Публиковать правила рейтинга").check();
    await teacher.getByRole("button", { name: "Добавить мероприятие" }).click();
    await teacher.getByLabel("Название мероприятия").fill(title);
    await teacher.getByLabel("Дата и время").fill(`${day}T09:00`);
    await teacher.getByLabel("Место", { exact: true }).fill("А-310");
    await teacher.getByLabel("Вес", { exact: true }).fill("2");
    await teacher.getByLabel("Описание").fill("Подготовьте запросы и пояснение к ним.");
    await teacher.getByLabel("Темы").fill("SQL и транзакции");
    await teacher.getByLabel("Требования").fill("Приложите результаты запросов.");
    await teacher.getByLabel("Связь с контрольной точкой").selectOption(title);
    await teacher.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect.poll(() => db.coursePlan.count({ where: { subjectId: subject.id, draftRevision: 1 } })).toBe(1);
    await login(page, "student1", "LevelUpDemo1!", /dashboard$/);
    await page.goto(base);
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await teacher.reload();
    await teacher.getByLabel("Причина публикации").fill("Первый учебный план");
    await teacher.getByRole("button", { name: "Опубликовать версию" }).click();
    await expect(teacher.getByText("Опубликована версия 1.0")).toBeVisible();
    const initial = await db.coursePlanVersion.findFirstOrThrow({ where: { subjectId: subject.id, number: 1 } });
    await expect(db.coursePlanVersion.update({ where: { id: initial.id }, data: { reason: "Перезапись" } })).rejects.toThrow();
    await page.goto("/notifications?type=DEADLINE");
    const reminder = page.locator("article").filter({ hasText: title }).filter({ hasText: "через 7 дней" });
    await reminder.getByRole("link", { name: "Открыть" }).click();
    await expect(page.getByText("SQL и транзакции")).toBeVisible();
    await expect(page.getByText(/20 · вес 2/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Задать вопрос преподавателю/ })).toHaveAttribute("href", `/checkpoints/${point.id}`);
    const activityUrl = page.url();
    await page.getByRole("button", { name: "Добавить в мой календарь" }).click();
    await expect(page.getByRole("button", { name: "Снять личную отметку" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Снять личную отметку" })).toBeVisible();
    const rating = `/rating?course=${subject.id}`;
    await page.goto(rating);
    await page.getByLabel("Предполагаемый балл").fill("15");
    await expect(page.getByText(/Прогноз: 30 баллов/)).toBeVisible();
    await expect(page.getByText("Итоговая оценка: Ещё не выставлена")).toBeVisible();
    expect(await db.courseResult.count({ where: { enrollmentId: subject.enrollments[0].id } })).toBe(0);
    await teacher.getByLabel("Дата и время").fill(`${moved}T14:00`);
    await teacher.getByLabel("Причина публикации").fill("Перенос по расписанию");
    await teacher.getByRole("button", { name: "Опубликовать версию" }).click();
    await expect(teacher.getByText("Опубликована версия 2.0")).toBeVisible();
    expect((await db.coursePlanVersion.findUniqueOrThrow({ where: { id: initial.id } })).data).toEqual(initial.data);
    await page.goto(`${base}/history`);
    await expect(page.getByText(/Дата и время.*09:00.*14:00/)).toBeVisible();
    await page.goto("/notifications?type=COURSE_PLAN");
    await expect(page.getByText(/версия 2.0 · Перенос по расписанию/)).toBeVisible();
    await page.goto(`/calendar?view=day&day=${day}`);
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);
    await page.goto(`/calendar?view=day&day=${moved}`);
    await expect(page.locator("article").filter({ hasText: title })).toContainText("14:00");
    await expect(page.locator("article").filter({ hasText: title })).toContainText("В моём плане");
    await page.getByLabel("Название", { exact: true }).fill("Личное тестовое напоминание");
    await page.getByRole("button", { name: "Добавить напоминание" }).click();
    await expect(page.getByText("Личное тестовое напоминание")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Личное тестовое напоминание")).toBeVisible();
    await page.locator("article").filter({ hasText: "Личное тестовое напоминание" }).getByRole("button", { name: "Удалить" }).click();
    await expect(page.getByText("Личное тестовое напоминание")).toHaveCount(0);
    const storedPlan=await db.coursePlan.findUniqueOrThrow({where:{subjectId:subject.id}});
    const imminent=parsePlan(storedPlan.draft)!;
    imminent.activities[0].startsAt=fromLocal(`${addDays(dayKey(new Date()),1)}T14:00`)!.toISOString();
    const republished=await teacher.request.post("/api/academic-planning", {headers:{origin:new URL(baseURL!).origin}, data:{
      operation:"savePlan",subjectId:subject.id,revision:storedPlan.draftRevision,plan:imminent,intent:"publish",reason:"Перенос на завтра",
    }});
    expect(republished.status()).toBe(200);
    await page.goto("/notifications?type=DEADLINE");
    await expect(page.locator("article").filter({hasText:title})).toHaveCount(1);
    await expect(page.locator("article").filter({hasText:title})).toContainText("Контрольная точка завтра");
    await page.reload();
    await expect(page.locator("article").filter({hasText:title})).toHaveCount(1);
    await teacher.goto(`${editor}/results`);
    await teacher.getByText(`${title} · — / 20 баллов`, { exact: true }).click();
    await teacher.getByLabel("Баллы", { exact: true }).fill("15");
    await teacher.getByRole("button", { name: "Опубликовать результат" }).click();
    await expect(teacher.getByText(`${title} · 15 / 20 баллов`, { exact: true })).toBeVisible();
    expect(await db.xpEvent.count({where:{studentId:student.id,eventKey:`quest:${quest.id}`}})).toBe(0);
    await teacher.getByLabel("Подтвердить сдачу контрольной точки").check();
    await teacher.getByRole("button", { name: "Опубликовать результат" }).click();
    await expect(teacher.getByText("Сдача контрольной точки подтверждена")).toBeVisible();
    expect(await db.xpEvent.findMany({where:{studentId:student.id,eventKey:`quest:${quest.id}`},select:{amount:true}})).toEqual([{amount:70}]);
    expect(await db.questCompletion.count({where:{questId:quest.id}})).toBe(1);
    await page.goto(rating);
    await expect(page.locator(".rating-numbers > div").first()).toContainText("30");
    await teacher.getByLabel("Итоговая оценка").selectOption("4");
    await teacher.getByRole("button", { name: "Сохранить итоговую оценку" }).click();
    await expect(teacher.getByText("Итоговая оценка сохранена.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Итоговая оценка: 4")).toBeVisible();
    await login(outsider, "student2", "LevelUpDemo2!", /dashboard$/);
    for (const path of [rating, activityUrl, `${base}/history`]) {
      await outsider.goto(path);
      await expect(outsider.getByRole("heading", { name: "Страница недоступна" })).toBeVisible();
    }
    const response = await outsider.request.post("/api/academic-planning", { headers: { origin: new URL(baseURL!).origin }, data: {
      operation: "calendarActivity", subjectId: subject.id, activityId: new URL(activityUrl).pathname.split("/").at(-1), choice: "add",
    } });
    expect(response.status()).toBe(404);
    const forgedGrade=await outsider.request.post("/api/academic-planning", {headers:{origin:new URL(baseURL!).origin},data:{operation:"finalGrade",enrollmentId,grade:"5"}});
    expect(forgedGrade.status()).toBe(403);
    await outsider.goto("/profile");
    await outsider.getByRole("button", {name:"Выйти из аккаунта"}).click();
    await expect(outsider).toHaveURL(/login$/);
    await login(outsider,"teacher2","LevelUpTeacher2!",/\/teacher$/);
    await outsider.goto(editor);
    await expect(outsider.getByRole("heading",{name:"Страница недоступна"})).toBeVisible();
    const otherTeacher=await outsider.request.post("/api/academic-planning", {headers:{origin:new URL(baseURL!).origin},data:{operation:"finalGrade",enrollmentId,grade:"5"}});
    expect(otherTeacher.status()).toBe(404);
    expect((await db.enrollment.findUniqueOrThrow({where:{id:enrollmentId}})).finalGrade).toBe(4);
  } finally {
    await teacher.close();
    await outsider.close();
    await db.calendarEntry.deleteMany({where:{subjectId:subject.id}});
    await db.notification.deleteMany({where:{userId:student.id,href:{contains:subject.id}}});
    await db.xpEvent.deleteMany({where:{studentId:student.id,eventKey:`quest:${quest.id}`}});
    await db.enrollment.delete({where:{id:enrollmentId}});
  }
});

test("an optional event enters the calendar only after the teacher approves participation", async ({ page, browser }) => {
  const teacherUser = await db.user.findUniqueOrThrow({ where: { login: "teacher1" } });
  const student = await db.user.findUniqueOrThrow({ where: { login: "student1" } });
  const subject = await db.subject.findFirstOrThrow({ where: { instructorId: teacherUser.id, enrollments: { some: { studentId: student.id } } },
    include: { plan: { include: { versions: { orderBy: { number: "desc" }, take: 1 } } } } });
  const extra = parsePlan(subject.plan?.versions[0]?.data)!.activities.find(item => item.optional && item.registration)!;
  const activityUrl = `/courses/${subject.id}/map/${extra.id}`;
  const dayUrl = `/calendar?view=day&day=${dayKey(new Date(extra.startsAt))}&type=extra`;
  const where = { studentId: student.id, subjectId: subject.id, activityId: extra.id };
  const teacher = await browser.newPage();
  try {
    await db.calendarEntry.deleteMany({ where });
    await login(page, "student1", "LevelUpDemo1!", /dashboard$/);
    await page.goto(activityUrl);
    await page.getByRole("button", { name: "Участвовать", exact: true }).click();
    await expect(page.getByText(/ожидает подтверждения/)).toBeVisible();
    await page.goto(dayUrl);
    await expect(page.locator(`a[href="${activityUrl}"]`)).toHaveCount(0);
    await login(teacher, "teacher1", "LevelUpTeacher1!", /\/teacher$/);
    await teacher.goto(`/teacher/courses/${subject.id}/results`);
    await teacher.getByRole("button", { name: "Подтвердить участие" }).click();
    await expect(teacher.getByRole("button", { name: "Подтвердить участие" })).toHaveCount(0);
    await page.goto(dayUrl);
    await page.getByRole("link", { name: extra.title, exact: true }).click();
    await expect(page.getByText("Участие подтверждено", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Не участвовать", exact: true }).click();
    await expect(page.getByText("Вы отказались от участия", { exact: true })).toBeVisible();
    await page.goto(dayUrl);
    await expect(page.locator(`a[href="${activityUrl}"]`)).toHaveCount(0);
  } finally {
    await teacher.close();
    await db.calendarEntry.deleteMany({ where });
  }
});

test("academic planning fits six widths and passes automated accessibility checks", async ({ page }) => {
  await login(page, "student1", "LevelUpDemo1!", /dashboard$/);
  await page.goto("/courses");
  const course = await page.locator('main a[href$="/map"]').first().getAttribute("href");
  await page.goto(course!);
  const activity = await page.locator(".course-node").first().getAttribute("href");
  const paths = ["/teachers", "/consultations", "/courses", course!, activity!, "/rating", "/calendar?view=month"];
  for (const width of [360, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} ${width}px`).toBeLessThanOrEqual(width);
      if (width === 360 || width === 1440) {
        const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(audit.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), `${path} ${width}px`).toEqual([]);
      }
    }
  }
});
