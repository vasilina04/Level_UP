import {describe,expect,it} from "vitest";
import {achievementDefinitions,documentTransitions,levelFor,percent,questReward,xpRewards} from "../../src/lib/rules";
import {addDays,dayKey,validDay,validScheduleDay,weekOf} from "../../src/lib/dates";
import {gradeTrend} from "../../src/lib/grade-trend";
import {checkpointProgress,weightedMean} from "../../src/lib/weights";
describe("XP thresholds",()=>{
  it.each([[0,1],[199,1],[200,2],[599,2],[600,3],[1199,3],[1200,4],[2000,5]])("%i XP maps to level %i",(xp,level)=>expect(levelFor(xp).level).toBe(level));
  it("uses XP earned within the current level",()=>expect(levelFor(1250)).toMatchObject({floor:1200,ceiling:2000,earned:50,target:800,percent:6}));
  it("keeps all reward amounts configurable in one table",()=>expect(Object.values(xpRewards)).toEqual([30,70,200,150,500]));
  it("uses the completion time for personal quests and the verified reward for academic quests",()=>{
    const due=new Date("2026-11-13T04:00:00Z"),later=new Date(+due+1000);
    expect(questReward("PERSONAL",due,null,later)).toBe(0);
    expect(questReward("PERSONAL",due,due,later)).toBe(30);
    expect(questReward("LAB",due,later,later)).toBe(70);
  });
});
describe("semester and calendar",()=>{
  it("calculates progress from actual counts",()=>{expect(percent(13,20)).toBe(65);expect(percent(0,0)).toBe(0);});
  it("handles local midnight and the previous week",()=>{
    expect(dayKey(new Date("2026-11-13T14:00:00Z"))).toBe("2026-11-14");
    expect(weekOf("2026-11-15")).toBe("2026-11-09");
    expect(addDays("2026-12-31",1)).toBe("2027-01-01");
    expect(validDay("2026-02-30")).toBe(false);
  });
  it("defines six server achievement thresholds",()=>expect(achievementDefinitions.map(a=>a.goal)).toEqual([1,5,5,3,1,3]));
  it("keeps week navigation inside the supported calendar range",()=>{
    expect(validScheduleDay("0000-01-01")).toBe(false);
    expect(validScheduleDay("9999-12-31")).toBe(false);
    expect(validScheduleDay("2026-11-13")).toBe(true);
  });
});
describe("document transitions",()=>{
  it("allows review before approval and treats completed statuses as terminal",()=>{
    expect(documentTransitions.SUBMITTED).toEqual(["REVIEW"]);
    expect(documentTransitions.REVIEW).toEqual(["APPROVED","REJECTED"]);
    expect(documentTransitions.APPROVED).toEqual(["READY"]);
    expect(documentTransitions.READY).toEqual([]);
    expect(documentTransitions.REJECTED).toEqual([]);
    expect(documentTransitions.DRAFT).toEqual([]);
  });
});
describe("weekly grade trend",()=>{
  it("uses recorded grades, preserves empty weeks, and keeps the source entries",()=>{
    const grade=(id:string,day:string,value:number)=>({id,assessedAt:new Date(day+"T01:00:00Z"),subject:"Дисциплина",title:"Работа",value,points:value*2,maxPoints:10,weight:id==="b"?3:1});
    const rows=gradeTrend([grade("late","2026-11-19",5),grade("b","2026-11-05",4),grade("a","2026-11-03",3)]);
    expect(rows.map(w=>[w.week,w.average])).toEqual([["2026-11-02",3.75],["2026-11-09",null],["2026-11-16",5]]);
    expect(rows[0].grades.map(g=>g.id)).toEqual(["a","b"]);
  });
});
it("counts completed checkpoint weight separately from the number completed",()=>{
  expect(checkpointProgress([{weight:1,passedAt:new Date()},{weight:4,passedAt:null}])).toEqual({done:1,all:2,completedWeight:1,totalWeight:5,percent:20});
  expect(weightedMean([])).toBeNull();
});
