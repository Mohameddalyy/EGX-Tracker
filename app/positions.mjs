export function initPositions(db){db.exec(`CREATE TABLE IF NOT EXISTS fills(id INTEGER PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,entry_id INTEGER NOT NULL REFERENCES journal(id),recorded_at TEXT NOT NULL,day TEXT NOT NULL,side TEXT NOT NULL,quantity INTEGER NOT NULL,price REAL NOT NULL,fees REAL NOT NULL,note TEXT NOT NULL,voided_at TEXT,void_reason TEXT);`);}
export function position(fills,plan,mark=null){
 let quantity=0,cost=0,realized=0,buyValue=0,bought=0,fees=0,lastDay=null;
 for(const f of fills.filter(f=>!f.voided_at)){
  lastDay=f.day;fees+=f.fees;
  if(f.side==='Buy'){quantity+=f.quantity;cost+=f.quantity*f.price+f.fees;buyValue+=f.quantity*f.price;bought+=f.quantity;}
  else{if(f.quantity>quantity)throw Error('Cannot sell more shares than held');const basis=cost/quantity*f.quantity;realized+=f.quantity*f.price-f.fees-basis;quantity-=f.quantity;cost=quantity?cost-basis:0;}
 }
 const validMark=mark&&mark.day>=lastDay&&Number.isFinite(mark.close)?mark:null;
 return {quantity,costBasis:cost,averageCost:quantity?cost/quantity:null,averageBuyPrice:bought?buyValue/bought:null,totalFees:fees,realized,
  marketValue:quantity&&validMark?quantity*validMark.close:null,unrealized:quantity&&validMark?quantity*validMark.close-cost:null,
  markDay:validMark?.day??null,markPrice:validMark?.close??null,
  riskToStop:quantity?Math.max(0,cost-quantity*plan.stop):0,targetProfit:quantity?quantity*plan.target-cost:0};
}
export function entryFills(db,id){return db.prepare('SELECT * FROM fills WHERE entry_id=? ORDER BY day,id').all(id);}
export function addFill(db,p){
 if(typeof p.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(p.requestId))throw Error('Invalid request identifier');
 const prior=db.prepare('SELECT * FROM fills WHERE request_id=?').get(p.requestId);
 if(prior){if(prior.entry_id!==p.id||prior.day!==p.day||prior.side!==p.side||prior.quantity!==p.quantity||prior.price!==p.price||prior.fees!==p.fees||prior.note!==p.note)throw Error('Retry differs from the saved fill; reload first');return {id:prior.id};}
 const e=db.prepare('SELECT plan FROM journal WHERE id=?').get(p.id);if(!e)throw Error('Save a journal plan first');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(typeof p.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.day)||!Number.isFinite(Date.parse(p.day))||new Date(p.day).toISOString().slice(0,10)!==p.day||p.day>today)throw Error('Enter a valid fill date, no later than today in Cairo');
 if(!['Buy','Sell'].includes(p.side)||!Number.isSafeInteger(p.quantity)||p.quantity<=0||p.quantity>1e9||!Number.isFinite(p.price)||p.price<=0||p.price>1e9||!Number.isFinite(p.fees)||p.fees<0||p.fees>1e12||typeof p.note!=='string'||p.note.length>2000)throw Error('Enter positive whole shares, a positive price and nonnegative fees');
 const fills=entryFills(db,p.id).filter(f=>!f.voided_at);if(fills.length&&p.day<fills.at(-1).day)throw Error('Record fills in date order; void later fills before backdating');
 position([...fills,p],JSON.parse(e.plan));
 const r=db.prepare('INSERT INTO fills(request_id,entry_id,recorded_at,day,side,quantity,price,fees,note) VALUES(?,?,?,?,?,?,?,?,?)').run(p.requestId,p.id,new Date().toISOString(),p.day,p.side,p.quantity,p.price,p.fees,p.note);return {id:Number(r.lastInsertRowid)};
}
export function voidLastFill(db,p){
 if(!Number.isSafeInteger(p.fillId)||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>2000)throw Error('A correction reason is required');
 const fill=db.prepare('SELECT * FROM fills WHERE id=?').get(p.fillId);if(!fill)throw Error('Fill not found');if(fill.voided_at)return {saved:true};
 if(entryFills(db,fill.entry_id).filter(f=>!f.voided_at).at(-1)?.id!==p.fillId)throw Error('Only the latest active fill can be voided; correct in reverse order');
 db.prepare('UPDATE fills SET voided_at=?,void_reason=? WHERE id=?').run(new Date().toISOString(),p.reason.trim(),p.fillId);return {saved:true};
}
