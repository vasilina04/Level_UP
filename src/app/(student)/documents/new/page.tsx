import { documentTypes } from "@/lib/rules";
import { Back, SectionTitle } from "@/components/common";
import { RequestForm } from "@/components/document-ui";
import { requireStudent } from "@/lib/access";
export default async function NewDocument({searchParams}:{searchParams:Promise<{type?:string}>}){
  const {name,student}=await requireStudent();
  const value=(await searchParams).type;
  const type=value&&Object.hasOwn(documentTypes,value)?value as keyof typeof documentTypes:"CERTIFICATE";
  return <><Back href="/documents" label="К заявкам"/><SectionTitle title="Новая заявка"/><RequestForm type={type} student={{name,year:student.year,program:student.program}}/></>;
}
