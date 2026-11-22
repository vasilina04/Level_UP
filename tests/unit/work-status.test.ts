import { describe,expect,it } from "vitest";
import { workStatus } from "../../src/lib/work-status";

describe("checkpoint lifecycle labels",()=>{
  const now=new Date("2026-11-22T12:00:00Z");
  const future=new Date(+now+86400000),past=new Date(+now-86400000);
  it.each([
    ["NOT_STARTED",future,null,"Не начато"],
    ["IN_PROGRESS",future,null,"В процессе"],
    ["SUBMITTED",past,null,"Отправлено на проверку"],
    ["REVISION",past,null,"На доработке"],
    ["NOT_STARTED",past,null,"Просрочено"],
    ["SUBMITTED",past,now,"Выполнено"],
  ] as const)("derives %s with existing official records",(status,due,passedAt,label)=>{
    expect(workStatus({workStatus:status,due,passedAt},now)).toBe(label);
  });
});
