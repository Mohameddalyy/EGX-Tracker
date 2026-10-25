import {finite,required,plan} from './contract.mjs';
import {roundTick} from './math.mjs';

// Exact decimal products, rounded once to piastres, half up. Prices retain tick precision.
function fraction(value) {
  required(finite(value)&&value>=0&&value<=1e12,'Invalid monetary value');
  const [base,exp='0']=String(value).split('e'), [integer,decimal='']=base.split('.');
  const power=Number(exp)-decimal.length;
  return power>=0 ? [BigInt(integer+decimal)*10n**BigInt(power),1n] : [BigInt(integer+decimal),10n**BigInt(-power)];
}
export function productCents(...values) {
  let n=100n,d=1n;
  for(const value of values){const [a,b]=fraction(value);n*=a;d*=b;}
  const result=Number((2n*n+d)/(2n*d));
  required(Number.isSafeInteger(result),'Monetary precision overflow');return result;
}
export const cents=value=>productCents(value);
export const egp=value=>value/100;
export function costs(scenario) {required(['base','stress'].includes(scenario),'Unknown friction scenario');return plan.costs[scenario];}
export function feeCents(quantity,price,scenario) {
  if(quantity===0)return 0;
  const c=costs(scenario);return cents(c.fixedEGPPerFilledOrder)+productCents(quantity,price,c.notionalChargeFractionPerSide);
}
export function buyCommitment(quantity,price,scenario) {
  return quantity ? productCents(quantity,price)+feeCents(quantity,price,scenario)+cents(costs(scenario).fixedEGPPerFilledOrder) : 0;
}
export function plannedLoss(quantity,entry,stop,bands,scenario) {
  if(!quantity)return 0;
  const exit=roundTick(Math.max(0,stop*(1-costs(scenario).adverseSlippageFractionPerSide)),bands,'floor');
  return Math.max(0,productCents(quantity,entry)-productCents(quantity,exit))+feeCents(quantity,entry,scenario)+feeCents(quantity,exit,scenario);
}
export function forwardLoss(quantity,mark,stop,bands,scenario) {
  const exit=roundTick(Math.max(0,stop*(1-costs(scenario).adverseSlippageFractionPerSide)),bands,'floor');
  return Math.max(0,productCents(quantity,mark)-productCents(quantity,exit))+feeCents(quantity,exit,scenario);
}
