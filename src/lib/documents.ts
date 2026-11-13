import { db } from "@/lib/db";
import { staffScope } from "@/lib/access";
import { documentStatuses, documentTransitions, type Status } from "@/lib/rules";
import type { DocumentRequest } from "@prisma/client";

type RequestFields=Pick<DocumentRequest,"id"|"type"|"recipient"|"details"|"delivery"|"contactEmail"|"contactPhone"|"postalAddress">;
export function saveDocument(studentId:string, fields:RequestFields, review:{name:string,year:number,program:string}|null) {
  return db.$transaction(async tx => {
    const submit=Boolean(review);
    const status=submit?"SUBMITTED":"DRAFT";
    const {id,...data}=fields;
    const reviewed=review?{reviewedAt:new Date(),reviewedName:review.name,reviewedYear:review.year,reviewedProgram:review.program}:{};
    const submittedResult=(saved:DocumentRequest|null)=>{
      if(!saved) return {kind:"missing"} as const;
      if(submit&&(Object.keys(data) as (keyof typeof data)[]).every(key=>saved[key]===data[key])) return {kind:"saved",id:saved.id} as const;
      return {kind:"conflict"} as const;
    };
    const created=await tx.documentRequest.createMany({data:[{...fields,...reviewed,studentId,status}],skipDuplicates:true});
    if (!created.count) {
      const current=await tx.documentRequest.findFirst({where:{id,studentId}});
      if (!current) return {kind:"missing"} as const;
      if(current.status!=="DRAFT") return submittedResult(current);
      const updated=await tx.documentRequest.updateMany({where:{id,studentId,status:"DRAFT"},data:{...data,...reviewed,status}});
      if (!updated.count) {
        return submittedResult(await tx.documentRequest.findFirst({where:{id:fields.id,studentId}}));
      }
      if (!submit) return {kind:"saved",id:current.id} as const;
    }
    await tx.documentStatusHistory.create({data:{documentId:fields.id,actorId:studentId,status}});
    return {kind:"saved",id:fields.id} as const;
  });
}
export function updateDocument(actorId:string,facultyId:string|null,id:string,expected:Status,status:Status,comment:string) {
  return db.$transaction(async tx => {
    const where={id,...staffScope(facultyId),status:expected};
    const item=await tx.documentRequest.findFirst({where});
    if (!item || !documentTransitions[expected].includes(status)) return false;
    const result=await tx.documentRequest.updateMany({where,data:{status}});
    if (!result.count) return false;
    const history=await tx.documentStatusHistory.create({data:{documentId:id,actorId,status,comment}});
    await tx.auditLog.create({data:{actorId,targetId:id,action:"document.status",details:{from:expected,to:status,comment}}});
    await tx.notification.create({data:{userId:item.studentId,type:"DOCUMENT",title:"Обновлена заявка №"+item.number,body:documentStatuses[status],href:"/documents/"+id,eventKey:"document:"+history.id}});
    return true;
  });
}
