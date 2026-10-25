import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {readFileSync} from 'node:fs';
import {required} from './contract.mjs';

// The frozen schema uses conditional subschemas without repeated type declarations.
// Disable strictTypes lint only; validation, formats and all constraints remain active.
const ajv = new Ajv2020({allErrors:true, strictTypes:false, allowUnionTypes:true});
addFormats(ajv, ['date-time']);
const schema = JSON.parse(readFileSync(new URL('./decision-schema.json', import.meta.url)));
const validate = ajv.compile(schema);
const risk = ajv.compile({$ref:schema.$id+'#/$defs/risk'});
export function validateSchema(value, kind='decision') {
  const check = kind==='risk' ? risk : validate;
  required(check(value), 'JSON_SCHEMA: '+ajv.errorsText(check.errors, {separator:'; '}));
  return true;
}
