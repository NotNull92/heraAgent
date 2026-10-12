import assert from 'node:assert/strict';

export function assertSingleSkillSpawn(trace,astraId,astraRole){
  const records=trace.filter(row=>row.type==='response_item').map(row=>row.payload);
  const calls=records.filter(item=>item.type==='function_call'&&/spawn_agent$/.test(item.name));
  const seen=new Set();let created=0,rejected=0;
  for(const call of calls){
    assert(call.call_id&&!seen.has(call.call_id),'Spawn call IDs must be unique');seen.add(call.call_id);
    const args=JSON.parse(call.arguments);
    assert.equal(args.agent_type,astraRole);assert.equal(args.fork_context,false);
    const outputs=records.filter(item=>item.type==='function_call_output'&&item.call_id===call.call_id);
    assert.equal(outputs.length,1,'Each spawn attempt needs exactly one observed result');
    const output=outputs[0];assert(records.indexOf(output)>records.indexOf(call),'Spawn result must follow its call');
    if(output.output==='Provide either message or items, but not both'){
      // This pinned validation error occurs before creation; allow one correction, never an uncertain spawn retry.
      assert.equal(created,0,'No rejected spawn after creating Astra');assert.equal(rejected,0,'No repeated invalid spawn attempts');
      assert.equal(typeof args.message,'string');assert(Array.isArray(args.items)&&args.items.length>0);
      const next=calls[calls.indexOf(call)+1];assert(next&&records.indexOf(output)<records.indexOf(next),'Observe rejection before retry');
      rejected++;continue;
    }
    const result=JSON.parse(output.output);assert.equal(result.agent_id,astraId,'Spawn result must identify the observed Astra');
    assert(args.items?.some(item=>item.type==='skill'&&item.name==='grilling'),'Spawn must attach grilling');
    assert(!Object.hasOwn(args,'message'),'Successful skill spawn must use items only');created++;
  }
  assert.equal(created,1,'Exactly one successful Astra spawn is required');
  return {attempts:calls.length,created,rejected};
}
