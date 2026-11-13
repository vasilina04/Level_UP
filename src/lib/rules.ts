export const xpRewards = { PERSONAL: 30, LAB: 70, CREDIT: 200, STAGE: 150, SEMESTER: 500 };
export function questReward(kind:"PERSONAL"|"LAB"|"CREDIT",due:Date,completedAt:Date|null,now:Date) {
  return kind==="PERSONAL"&&(completedAt??now)>due?0:xpRewards[kind];
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
export const notificationTypes = { SCHEDULE: "Расписание", GRADE: "Оценки", DEADLINE: "Дедлайны", DOCUMENT: "Заявки", ACHIEVEMENT: "Достижения", ANNOUNCEMENT: "Деканат", TEACHER_REPLY:"Ответы преподавателей" } as const;
export const achievementDefinitions = [
  {code:"first", name:"Первый шаг", description:"Выполнить первый квест", rarity:"Обычное", icon:"flag", color:"violet", goal:1},
  {code:"labs", name:"Мастер лабораторных", description:"Подтвердить пять лабораторных работ", rarity:"Редкое", icon:"flask", color:"blue", goal:5},
  {code:"timely", name:"Без дедлайнов", description:"Выполнить пять личных задач в срок", rarity:"Редкое", icon:"zap", color:"gold", goal:5},
  {code:"explorer", name:"Исследователь", description:"Завершить три учебных модуля", rarity:"Редкое", icon:"compass", color:"mint", goal:3},
  {code:"finish", name:"Финишная прямая", description:"Завершить все контрольные точки семестра", rarity:"Эпическое", icon:"trophy", color:"gold", goal:1},
  {code:"weeks", name:"Серия побед", description:"Выполнить задания в трёх разных учебных неделях", rarity:"Эпическое", icon:"flame", color:"rose", goal:3},
] as const;
export type AchievementCode = typeof achievementDefinitions[number]["code"];
