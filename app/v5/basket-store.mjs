import {DatabaseSync} from 'node:sqlite';
import {hash,required} from './contract.mjs';
import {initialState,transition} from './basket-execution.mjs';
import {ms} from './execution-rules.mjs';

// Dedicated store, never the production tracker DB. Intent, reservation, event and state
// share one SQLite transaction; replay validates the event chain and resulting state.
export function openBasketStore(path,config=null) {
  const db=new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout=5000');
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    required(tables.every(t=>['basket_config','basket_state','basket_events'].includes(t.name)),'Refusing a non-isolated database');
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS basket_config(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS basket_state(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS basket_events(sequence INTEGER PRIMARY KEY,id TEXT UNIQUE NOT NULL,event TEXT NOT NULL,previousHash TEXT NOT NULL,eventHash TEXT NOT NULL,stateHash TEXT NOT NULL,result TEXT NOT NULL);');
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing=db.prepare('SELECT json FROM basket_config WHERE id=1').get();
      if(!existing){required(config,'New isolated ledger needs explicit config');db.prepare('INSERT INTO basket_config VALUES(1,?)').run(JSON.stringify(config));db.prepare('INSERT INTO basket_state VALUES(1,?)').run(JSON.stringify(initialState(config)));}
      else if(config)required(existing.json===JSON.stringify(config),'Immutable ledger/variant/scenario config mismatch');
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }catch(e){db.close();throw e;}
  const read=()=>JSON.parse(db.prepare('SELECT json FROM basket_state WHERE id=1').get().json);
  return {
    read,
    append(event,{clock=new Date()}={}) {
      required(typeof event.id==='string'&&event.id.length>0,'Unique event ID required');required(ms(event.at)<=+clock,'Cannot record a future commit');
      // Historical clock injection is for labeled engineering replay only. No live mode exists.
      db.exec('BEGIN IMMEDIATE');
      try {
        this.replay();
        const prior=db.prepare('SELECT * FROM basket_events WHERE id=?').get(event.id);
        if(prior){required(prior.event===JSON.stringify(event),'Event ID reuse with different payload');db.exec('COMMIT');return {...JSON.parse(prior.result),idempotent:true};}
        const before=read(),last=db.prepare('SELECT eventHash,stateHash,sequence FROM basket_events ORDER BY sequence DESC LIMIT 1').get(),config=JSON.parse(db.prepare('SELECT json FROM basket_config').get().json);
        required(last ? last.stateHash===hash(before)&&last.sequence===before.sequence : hash(before)===hash(initialState(config)),'Persisted state integrity mismatch');
        const {state,result}=transition(before,event),previousHash=last?.eventHash||hash(config);
        const eventHash=hash({previousHash,event,stateHash:hash(state)});
        db.prepare('INSERT INTO basket_events VALUES(?,?,?,?,?,?,?)').run(state.sequence,event.id,JSON.stringify(event),previousHash,eventHash,hash(state),JSON.stringify(result));
        db.prepare('UPDATE basket_state SET json=? WHERE id=1').run(JSON.stringify(state));db.exec('COMMIT');return result;
      }catch(e){db.exec('ROLLBACK');throw e;}
    },
    replay() {
      const config=JSON.parse(db.prepare('SELECT json FROM basket_config WHERE id=1').get().json);let state=initialState(config),previousHash=hash(config);
      for(const row of db.prepare('SELECT * FROM basket_events ORDER BY sequence').all()){
        const event=JSON.parse(row.event),next=transition(state,event);state=next.state;
        required(row.previousHash===previousHash&&row.stateHash===hash(state)&&row.eventHash===hash({previousHash,event,stateHash:hash(state)})&&row.result===JSON.stringify(next.result),'Event chain/replay corruption');previousHash=row.eventHash;
      }
      required(hash(state)===hash(read()),'Persisted state does not match replay');return {events:state.sequence,stateHash:hash(state),cashCents:state.cashCents,verified:true};
    },
    close(){db.close();}
  };
}
