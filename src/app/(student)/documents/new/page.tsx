import { Back, SectionTitle } from "@/components/common";
import { RequestForm } from "@/components/document-ui";
import { requireStudent } from "@/lib/access";
export default async function NewDocument(){
  const {name,student}=await requireStudent();
  return <><Back href="/documents" label="К заявкам"/><SectionTitle title="Новая заявка"/><RequestForm student={{name,year:student.year,program:student.program}}/></>;
}
