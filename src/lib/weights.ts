export function weightedMean(items:{value:number,weight:number}[]) {
  const weight=items.reduce((sum,item)=>sum+item.weight,0);
  return weight?items.reduce((sum,item)=>sum+item.value*item.weight,0)/weight:null;
}
export function checkpointProgress(points:{passedAt:Date|null,weight:number}[]) {
  const done=points.filter(point=>point.passedAt!==null);
  const completedWeight=done.reduce((sum,point)=>sum+point.weight,0);
  const totalWeight=points.reduce((sum,point)=>sum+point.weight,0);
  return {done:done.length,all:points.length,completedWeight,totalWeight,percent:totalWeight?Math.round(completedWeight/totalWeight*100):0};
}
