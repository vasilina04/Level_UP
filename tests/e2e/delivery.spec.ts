import { expect,test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const db=new PrismaClient();
test.afterAll(()=>db.$disconnect());
for(const method of ["EMAIL","PICKUP","POSTAL"]){
  test("request saves contact verification and delivery "+method,async({page})=>{
    await page.setViewportSize({width:360,height:800});
    await page.goto("/login");
    await page.locator('input[name="login"]').fill("student2");
    await page.locator('input[name="password"]').fill("LevelUpDemo2!");
    await page.getByRole("button",{name:"Войти в кабинет"}).click();
    await expect(page).toHaveURL(/dashboard$/);
    await page.goto("/documents/new");
    await expect(page.locator("fieldset").getByText("Марина Ветрова")).toBeVisible();
    await expect(page.locator("fieldset").getByText("Цифровой дизайн")).toBeVisible();
    await page.getByLabel("Адресат").fill("Учебный отдел");
    await page.getByLabel("Цель обращения").fill("Проверка доставки");
    await page.getByLabel("Способ получения").selectOption(method);
    await page.getByLabel("Электронная почта",{exact:true}).fill("student2@example.test");
    if(method==="POSTAL") await page.getByLabel("Почтовый адрес").fill("690000, Владивосток, ул. Учебная, 1");
    await page.getByLabel("Подтверждаю, что проверил(а) данные").check();
    const id=await page.locator('input[name="id"]').inputValue();
    try{
      await page.getByRole("button",{name:"Отправить заявку"}).click();
      await expect(page).toHaveURL(new RegExp("/documents/"+id+"$"));
      const item=await db.documentRequest.findUniqueOrThrow({where:{id}});
      expect(item).toMatchObject({status:"SUBMITTED",delivery:method,reviewedName:"Марина Ветрова",reviewedYear:3,reviewedProgram:"Цифровой дизайн"});
      expect(Boolean(item.postalAddress)).toBe(method==="POSTAL");
      expect(item.reviewedAt).toBeInstanceOf(Date);
      await expect(page.getByText("student2@example.test",{exact:true})).toBeVisible();
    }finally{
      await db.documentRequest.deleteMany({where:{id}});
    }
  });
}
