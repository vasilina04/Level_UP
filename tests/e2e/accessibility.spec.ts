import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const wcag=["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"];
const studentPages=["/dashboard","/semester-map","/semester-map/4","/quests","/achievements","/schedule","/grades","/documents","/documents/new","/notifications","/profile"];

test("WCAG automated audit on desktop, mobile and light theme",async({page},info)=>{
  test.setTimeout(180_000);
  const findings:{path:string,id:string,nodes:{target:unknown,summary?:string}[]}[]=[];
  async function audit(path:string) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    const result=await new AxeBuilder({page}).withTags(wcag).analyze();
    findings.push(...result.violations.map(v=>({path,id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
  }
  await audit("/login");
  await page.locator('input[name="login"]').fill("student1");
  await page.locator('input[name="password"]').fill("LevelUpDemo1!");
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
  await expect(page).toHaveURL(/dashboard$/);
  for(const path of studentPages) await audit(path);
  await page.setViewportSize({width:360,height:800});
  for(const path of ["/dashboard","/semester-map","/documents/new"]) {
    await audit(path);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  }
  await page.goto("/profile");
  await page.getByLabel("Тема").selectOption("light");
  await page.getByRole("button",{name:"Сохранить настройки"}).click();
  await expect(page.locator(".shell")).toHaveAttribute("data-theme","light");
  try {
    for(const path of ["/dashboard","/semester-map","/grades","/profile"]) await audit(path);
  } finally {
    await page.goto("/profile");
    await page.getByLabel("Тема").selectOption("dark");
    await page.getByRole("button",{name:"Сохранить настройки"}).click();
    await expect(page.locator(".shell")).toHaveAttribute("data-theme","dark");
  }
  await info.attach("axe-results.json",{body:JSON.stringify(findings,null,2),contentType:"application/json"});
  expect(findings).toEqual([]);
});

test("mobile menu closes on Escape and respects reduced motion",async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/login");
  await page.locator('input[name="login"]').fill("student2");
  await page.locator('input[name="password"]').fill("LevelUpDemo2!");
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.bringToFront();
  const nav=page.getByRole("navigation",{name:"Мобильное меню"});
  const summary=nav.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(nav.locator("details")).toHaveAttribute("open","");
  await nav.getByRole("link",{name:"Достижения"}).press("Escape");
  await expect(summary).toBeFocused();
  await expect(nav.locator("details")).not.toHaveAttribute("open","");
  await summary.click();
  await page.getByRole("heading",{name:"Привет, Марина!"}).click();
  await expect(nav.locator("details")).not.toHaveAttribute("open","");
  await nav.getByRole("link",{name:"Карта",exact:true}).click();
  await expect(page).toHaveURL(/semester-map$/);
  expect(await page.locator(".map-step").first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe("0s");
});
test("grade trend exposes the underlying grades at 360px",async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.goto("/login");
  await page.locator('input[name="login"]').fill("student2");
  await page.locator('input[name="password"]').fill("LevelUpDemo2!");
  await page.getByRole("button",{name:"Войти в кабинет"}).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto("/grades");
  await expect(page.getByText("Среднее за последнюю неделю")).toBeVisible();
  await expect(page.locator(".grade-trend .recharts-line-curve").first()).toBeVisible();
  await page.getByText("Оценки по неделям",{exact:true}).click();
  await expect(page.locator(".grade-week").getByText(/Типографика/).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
