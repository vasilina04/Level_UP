import { expect,test,type Page,type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { mkdir,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePlan } from "../../src/lib/course-data";

const db=new PrismaClient();
const widths=[360,375,390,430,768,1024,1440];
const wcag=["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"];
const evidence=process.env.AUDIT_EVIDENCE_DIR;
test.afterAll(()=>db.$disconnect());
test.use({reducedMotion:"reduce"});

async function login(page:Page,login:string,password:string,destination:RegExp) {
  await page.goto("/login");
  await page.locator('[name="login"]').fill(login);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
  await expect(page).toHaveURL(destination);
}

async function inspect(page:Page,info:TestInfo,role:string,pages:{path:string;name:string;axe?:boolean}[]) {
  const issues:{path:string;width:number;problem:string}[]=[];
  const browserMessages:{path:string;kind:string;message:string}[]=[];
  const responses:{width:number;path:string;status:number}[]=[];
  page.on("pageerror",error=>browserMessages.push({path:page.url(),kind:"pageerror",message:error.message}));
  page.on("console",entry=>{
    if(entry.type()==="warning"||entry.type()==="error") browserMessages.push({path:page.url(),kind:entry.type(),message:entry.text()});
  });
  if(evidence) for(const width of [360,390,768,1440]) await mkdir(join(evidence,String(width)),{recursive:true});
  for(const width of widths) {
    await page.setViewportSize({width,height:844});
    for(const item of pages) {
      const {path}=item;
      const response=await page.goto(path);
      const status=response?.status()??0;
      responses.push({width,path,status});
      if(status!==200||new URL(page.url()).pathname!==path.split("?")[0]) issues.push({path,width,problem:`HTTP ${status} · ${page.url()}`});
      await expect(page.getByRole("heading",{level:1})).toBeVisible();
      const actual=await page.evaluate(()=>document.documentElement.scrollWidth);
      if(actual>width) issues.push({path,width,problem:`Горизонтальная прокрутка до ${actual}px`});
      if(width<=820) {
        const covered=await page.evaluate(()=>{
          const footer=document.querySelector(".page-footer"),nav=document.querySelector(".bottom-nav");
          if(!footer||!nav||getComputedStyle(nav).display==="none") return false;
          window.scrollTo(0,document.documentElement.scrollHeight);
          return footer.getBoundingClientRect().bottom>nav.getBoundingClientRect().top+1;
        });
        if(covered) issues.push({path,width,problem:"Навигация перекрывает конец страницы"});
      }
      if(width===390) {
        await page.evaluate(()=>window.scrollTo(0,0));
        if(item.axe) {
          const audit=await new AxeBuilder({page}).withTags(wcag).analyze();
          for(const failure of audit.violations) issues.push({path,width,problem:`axe ${failure.id} · ${failure.nodes.map(node=>node.target.join(" ")).join(", ")}`});
        }
      }
      if(evidence&&[360,390,768,1440].includes(width)) {
        await page.evaluate(()=>window.scrollTo(0,0));
        const target=join(evidence,String(width),`${role}-${item.name}`);
        await page.screenshot({path:target+".png",fullPage:true,animations:"disabled"});
        await page.screenshot({path:target+".jpg",type:"jpeg",quality:85,fullPage:true,animations:"disabled"});
      }
    }
  }
  const report=JSON.stringify({role,widths,responses,issues,browserMessages},null,2);
  await info.attach(`${role}-matrix.json`,{body:report,contentType:"application/json"});
  if(evidence) await writeFile(join(evidence,`${role}-matrix.json`),report+"\n");
  expect(issues).toEqual([]);
  expect(browserMessages.filter(item=>item.kind!=="warning")).toEqual([]);
}

test("student screens across seven widths with mobile evidence",async({page},info)=>{
  test.setTimeout(360000);
  const [teacher,student]=await Promise.all([db.user.findUniqueOrThrow({where:{login:"teacher1"}}),db.user.findUniqueOrThrow({where:{login:"student1"}})]);
  const enrollment=await db.enrollment.findFirstOrThrow({where:{studentId:student.id,subject:{instructorId:teacher.id}},include:{subject:{include:{plan:{include:{versions:{orderBy:{number:"desc"},take:1}}}}},assessments:true}});
  const activity=parsePlan(enrollment.subject.plan?.versions[0]?.data)!.activities[0];
  const map=`/courses/${enrollment.subjectId}/map`;
  await inspect(page,info,"public",[{path:"/login",name:"login",axe:true}]);
  await login(page,"student1","LevelUpDemo1!",/dashboard$/);
  const pages=[
    {path:"/dashboard",name:"dashboard",axe:true},
    {path:"/quests",name:"quests"},{path:"/achievements",name:"achievements"},
    {path:"/schedule?view=week",name:"schedule",axe:true},{path:"/grades",name:"grades",axe:true},
    {path:"/calendar?view=month",name:"calendar",axe:true},{path:"/courses",name:"courses"},
    {path:map,name:"course-map",axe:true},{path:`${map}/${activity.id}`,name:"activity",axe:true},
    {path:`${map}/history`,name:"course-history"},{path:`/checkpoints/${enrollment.assessments[0].id}`,name:"checkpoint",axe:true},
    {path:`/rating?course=${enrollment.subjectId}`,name:"rating",axe:true},
    {path:"/teachers",name:"teachers"},{path:`/teachers/${teacher.id}`,name:"booking",axe:true},{path:"/consultations",name:"consultations"},
    {path:"/documents",name:"documents"},{path:"/documents/new",name:"new-document",axe:true},
    {path:"/notifications",name:"notifications",axe:true},{path:"/profile",name:"profile"},
  ];
  await inspect(page,info,"student",pages);
});

test("teacher and staff screens across seven widths with mobile evidence",async({page},info)=>{
  test.setTimeout(300000);
  const teacher=await db.user.findUniqueOrThrow({where:{login:"teacher1"}});
  const subject=await db.subject.findFirstOrThrow({where:{instructorId:teacher.id,enrollments:{some:{}}}});
  await login(page,"teacher1","LevelUpTeacher1!",/\/teacher$/);
  await inspect(page,info,"teacher",[
    {path:"/teacher",name:"questions"},{path:"/teacher/schedule",name:"schedule",axe:true},
    {path:"/teacher/consultations",name:"consultations",axe:true},{path:`/teacher/courses/${subject.id}`,name:"course-plan",axe:true},
    {path:`/teacher/courses/${subject.id}/results`,name:"gradebook",axe:true},
  ]);
  await page.context().clearCookies();
  await login(page,"staff","LevelUpStaff1!",/\/staff$/);
  await inspect(page,info,"staff",[{path:"/staff",name:"requests",axe:true},{path:"/staff/academic",name:"academics",axe:true}]);
});
