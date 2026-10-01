import { coachPosition } from "./onboardingCoach";
const rect = (left, top, width, height) => ({left,top,width,height,right:left+width,bottom:top+height});
test.each([
  [rect(541,395,614,52),1440,960],
  [rect(37,515,316,52),390,844],
  [rect(20,260,280,44),320,568],
  [rect(12,892,231,56),1440,960],
])("the guide leaves a visible action clickable", (target,w,h) => {
  const p=coachPosition(target,288,255,w,h), height=p.maxHeight ?? 255;
  expect(p.left).toBeGreaterThanOrEqual(0);
  expect(p.left+288).toBeLessThanOrEqual(w);
  expect(p.top).toBeGreaterThanOrEqual(0);
  expect(p.top+height).toBeLessThanOrEqual(h);
  expect(p.left<target.right && p.left+288>target.left && p.top<target.bottom && p.top+height>target.top).toBe(false);
});
test("an offscreen action gets an explicit return link",()=>{
  expect(coachPosition(rect(20,1200,300,44),288,230,390,844).offscreen).toBe(true);
});
