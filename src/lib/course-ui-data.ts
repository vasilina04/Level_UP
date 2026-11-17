import type { Rule } from "./course-data";

export const activityKinds={
  LAB:"Лабораторная работа", CONTROL:"Контрольная работа", TEST:"Тестирование", PRACTICE:"Практическое задание",
  PROJECT:"Защита проекта", CREDIT:"Зачёт", EXAM:"Экзамен", EXTRA:"Дополнительное мероприятие",
} as const;

export function applyRule(rule:Rule,value:number) {
  const capped=Math.min(rule.cap,value);
  return rule.rounding==="FLOOR"?Math.floor(capped):rule.rounding==="NEAREST"?Math.round(capped):Math.round(capped*100)/100;
}

export function courseGrade(rule:Rule,value:number) {
  return value>=rule.excellent?5:value>=rule.good?4:value>=rule.pass?3:2;
}
