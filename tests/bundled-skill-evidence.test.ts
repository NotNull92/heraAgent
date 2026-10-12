import {it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';

const rejection='Provide either message or items, but not both';
const textItem={type:'text',text:'Interview the user'};
const args={agent_type:'hera_astra',fork_context:false,items:[textItem,{type:'skill',name:'grilling'}]};
const attempt=(id:string,output:string,input:object=args)=>[
  {type:'response_item',payload:{type:'function_call',name:'spawn_agent',call_id:id,arguments:JSON.stringify(input)}},
  {type:'response_item',payload:{type:'function_call_output',call_id:id,output}}
];
const success=(id:string,child='astra')=>attempt(id,JSON.stringify({agent_id:child}));
const rejected=(id:string)=>attempt(id,rejection,{...args,message:'Duplicate text'});
const script="import {assertSingleSkillSpawn} from './scripts/bundled-skill-evidence.mjs';console.log(JSON.stringify(assertSingleSkillSpawn(JSON.parse(process.argv[1]),'astra','hera_astra')));";
it.each([
  ['one successful spawn',success('1'),{attempts:1,created:1,rejected:0}],
  ['one explicit pre-creation rejection then success',[...rejected('1'),...success('2')],{attempts:2,created:1,rejected:1}],
  ['text-only rejected attempt then skill-bearing success',[...attempt('1',rejection,{...args,message:'Duplicate text',items:[textItem]}),...success('2')],{attempts:2,created:1,rejected:1}]
])('accepts %s and reports rejected attempts separately',(_name,trace,expected)=>{
  const result=spawnSync(process.execPath,['--input-type=module','-e',script,JSON.stringify(trace)],{encoding:'utf8',windowsHide:true});
  expect(result.status,result.stderr).toBe(0);expect(JSON.parse(result.stdout)).toEqual(expected);
});
it.each([
  ['two actual creations',[...success('1'),...success('2')]],
  ['another child',success('1','other')],
  ['unknown failure',[...attempt('1','Unexpected internal error'),...success('2')]],
  ['missing result',success('1').slice(0,1)],
  ['duplicate result',[...success('1'),success('1')[1]]],
  ['no successful creation',rejected('1')],
  ['repeated invalid requests',[...rejected('1'),...rejected('2'),...success('3')]],
  ['rejection after creation',[...success('1'),...rejected('2')]],
  ['retry before rejection',[rejected('1')[0],...success('2'),rejected('1')[1]]],
  ['wrong role',attempt('1',JSON.stringify({agent_id:'astra'}),{...args,agent_type:'hera_go'})],
  ['inherited context',attempt('1',JSON.stringify({agent_id:'astra'}),{...args,fork_context:true})],
  ['missing skill',attempt('1',JSON.stringify({agent_id:'astra'}),{...args,items:[textItem]})],
  ['successful creation with message',attempt('1',JSON.stringify({agent_id:'astra'}),{...args,message:'Duplicate text'})]
])('rejects %s',(_name,trace)=>{
  const result=spawnSync(process.execPath,['--input-type=module','-e',script,JSON.stringify(trace)],{encoding:'utf8',windowsHide:true});
  expect(result.error).toBeUndefined();expect(result.status).not.toBe(0);
});
