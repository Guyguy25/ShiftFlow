import { pricingRecommendation } from "./pricingRecommendation";

test.each([["1-3","start"],["1 à 3","start"],["4-10","pro"],["11 à 20","pro"],["21+","business"],["Plus de 20","business"],[0,"start"],[3,"start"],[4,"pro"],[20,"pro"],[21,"business"]])("saved monthly volume %s recommends %s", (monthly_missions,tier)=>{
 expect(pricingRecommendation({monthly_missions})?.tier).toBe(tier);
});
test.each([[1,"start"],[36,"start"],[37,"pro"],[240,"pro"],[241,"business"],[300,"business"]])("saved annual volume %s recommends %s",(annual_events,tier)=>{
 expect(pricingRecommendation({annual_events})?.tier).toBe(tier);
});
test("monthly answers take precedence and intervenants do not count as collaborator seats",()=>{
 expect(pricingRecommendation({monthly_missions:"1-3",annual_events:300,team_size:"31+",people_per_mission:150})?.tier).toBe("start");
});
test.each([undefined,null,{}, {annual_events:""},{annual_events:null},{annual_events:false},{annual_events:-1},{annual_events:Infinity},{monthly_missions:"Activité ponctuelle / variable"}])("missing or unusable profile %j has no personalized recommendation",answers=>{
 expect(pricingRecommendation(answers)).toBeNull();
});
