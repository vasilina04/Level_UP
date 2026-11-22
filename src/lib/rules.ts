export const xpRewards = { PERSONAL: 0, LAB: 70, CREDIT: 200, STAGE: 150, SEMESTER: 500 };
export function questReward(kind:"PERSONAL"|"LAB"|"CREDIT",_due:Date,_completedAt:Date|null,_now:Date) {
  return kind==="PERSONAL"?0:xpRewards[kind];
}
export function levelFor(total: number) {
  const level = Math.floor((1 + Math.sqrt(1 + Math.max(total, 0) / 25)) / 2);
  const floor = 100 * level * (level - 1);
  const ceiling = floor + 200 * level;
  return { level, total, floor, ceiling, earned: total - floor, target: ceiling - floor, percent: Math.round((total - floor) / (ceiling - floor) * 100) };
}
export function percent(done: number, total: number) {
  return total ? Math.round(done / total * 100) : 0;
}
export const documentTypes = { CERTIFICATE: "Справка об обучении", APPLICATION: "Заявление на выдачу справки", CONSULTATION: "Индивидуальная консультация", OTHER: "Обращение в деканат" } as const;
export const documentDelivery = {EMAIL:"По электронной почте",PICKUP:"На бумаге в деканате",POSTAL:"Почтой по адресу"} as const;
export const documentStatuses = { DRAFT: "Черновик", SUBMITTED: "Отправлена", REVIEW: "На рассмотрении", APPROVED: "Одобрена", REJECTED: "Отклонена", READY: "Готова" } as const;
export type Status = keyof typeof documentStatuses;
export const documentTransitions: Record<Status, Status[]> = {
  DRAFT: [], SUBMITTED: ["REVIEW"], REVIEW: ["APPROVED", "REJECTED"], APPROVED: ["READY"], REJECTED: [], READY: [],
};
export const notificationTypes = { SCHEDULE: "Расписание", GRADE: "Оценки", DEADLINE: "Дедлайны", DOCUMENT: "Заявки", ACHIEVEMENT: "Достижения", ANNOUNCEMENT: "Деканат", TEACHER_REPLY:"Ответы преподавателей",CONSULTATION:"Консультации",COURSE_PLAN:"Планы курсов" } as const;
export const achievementDefinitions = [
  {code:"first", name:"Первый шаг", description:"Завершить первый подтверждённый учебный квест", rarity:"Обычное", icon:"flag", color:"violet", goal:1},
  {code:"labs", name:"Мастер лабораторных", description:"Подтвердить пять лабораторных работ", rarity:"Редкое", icon:"flask", color:"blue", goal:5},
  {code:"timely", name:"Без дедлайнов", description:"Завершить пять подтверждённых учебных заданий в срок", rarity:"Редкое", icon:"zap", color:"gold", goal:5},
  {code:"explorer", name:"Исследователь", description:"Завершить три учебных модуля", rarity:"Редкое", icon:"compass", color:"mint", goal:3},
  {code:"finish", name:"Финишная прямая", description:"Завершить все контрольные точки семестра", rarity:"Эпическое", icon:"trophy", color:"gold", goal:1},
  {code:"weeks", name:"Серия побед", description:"Выполнить задания в трёх разных учебных неделях", rarity:"Эпическое", icon:"flame", color:"rose", goal:3},
] as const;
export type AchievementCode = typeof achievementDefinitions[number]["code"];

export const documentServices = {
  CERTIFICATE: { title:"Студенческие справки и документы", description:"Запросите справку, подтверждающую обучение. Укажите назначение документа и выберите способ получения.", result:"Справка об обучении", required:"Электронная заявка и подтверждение персональных данных" },
  APPLICATION: { title:"Заявление на выдачу справки", description:"Оформите заявление на документ с особыми требованиями. В цели обращения укажите необходимые сведения и организацию-получателя.", result:"Ответ деканата по заявлению и подготовленный документ при одобрении", required:"Электронная заявка и описание требований к справке" },
  CONSULTATION: { title:"Решить проблему или получить консультацию", description:"Задайте деканату вопрос об учебных процедурах и документах. Для консультации по дисциплине используйте раздел преподавателей.", result:"Ответ сотрудника деканата", required:"Описание вопроса и контактные данные" },
  OTHER: { title:"Официальное обращение в деканат", description:"Отправьте предложение, вопрос или жалобу. Опишите обстоятельства и ожидаемый результат.", result:"Ответ сотрудника со статусом и историей рассмотрения", required:"Текст обращения и контактные данные" },
} as const;
