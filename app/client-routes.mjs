import {clientOverview,registeredLedger,controlLedger,recordNote,clientHistory,getCheckpoint,acceptanceCases,startComprehension,answerComprehension,comprehensionStatus} from './v5/client-service.mjs';
export async function clientRoute({root,url,req,send,token}){
 const p=url.pathname;if(!p.startsWith('/api/client'))return false;
 try{
 if(req.method==='GET'){
  if(p==='/api/client')send(200,{...clientOverview(root),token});
  else if(p==='/api/client/history')send(200,clientHistory(root));
  else if(p==='/api/client/checkpoint')send(200,getCheckpoint(root,url.searchParams.get('id')));
  else if(p==='/api/client/acceptance')send(200,{cases:acceptanceCases(root).map(c=>({id:c.id})),status:comprehensionStatus(root)});
  else send(404,{error:'Unknown client endpoint'});return true;
 }
 if(req.method==='POST'){
  if(req.headers['x-egx-token']!==token){send(403,{error:'Refresh the action desk before submitting'});return true;}
  const origin=req.headers.origin;if(origin&&origin!==`http://${req.headers.host}`){send(403,{error:'Invalid origin'});return true;}
  let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>30000){send(413,{error:'Submission too large'});return true;}}const body=JSON.parse(text);let value;
  if(p==='/api/client/control'){const entry=registeredLedger(root,body.ledgerId);if(entry.allowControls!==true)throw Error('Controls disabled for this ledger');value=controlLedger(entry.path,body);}
  else if(p==='/api/client/note')value=recordNote(root,body);
  else if(p==='/api/client/acceptance/start')value=startComprehension(root,body);
  else if(p==='/api/client/acceptance/answer')value=answerComprehension(root,body);
  else {send(404,{error:'Unknown client endpoint'});return true;}
  send(200,value);return true;
 }
 send(405,{error:'Method not allowed'});return true;
 }catch(e){send(400,{error:e.message});return true;}
}
