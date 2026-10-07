import {z} from 'zod';

const windowSchema=z.object({usedPercent:z.number(),windowDurationMins:z.number().nullable(),resetsAt:z.number().nullable()});
const snapshotSchema=z.object({limitId:z.string().nullable(),normalModelSlug:z.string().nullable().optional(),primary:windowSchema.nullable(),secondary:windowSchema.nullable()});
const responseSchema=z.object({rateLimits:snapshotSchema,rateLimitsByLimitId:z.record(z.string(),snapshotSchema).nullable().optional()});
export type LimitWindow=z.infer<typeof windowSchema>;
export type LimitSnapshot=z.infer<typeof snapshotSchema>;

// Keeps only the buckets and windows the native account/rateLimits/read returned; nothing is estimated.
export function parseLimits(value:unknown):LimitSnapshot[]{
  const response=responseSchema.parse(value);const buckets=Object.values(response.rateLimitsByLimitId??{});
  return buckets.length?buckets:[response.rateLimits];
}
// account/rateLimits/updated is sparse: an absent window does not clear the last observed one.
export function mergeLimits(current:LimitSnapshot[],update:unknown):LimitSnapshot[]{
  const parsed=z.object({rateLimits:snapshotSchema}).safeParse(update);if(!parsed.success)return current;
  const next=parsed.data.rateLimits;const index=current.findIndex(s=>s.limitId===next.limitId);if(index<0)return [...current,next];
  const old=current[index]!;const merged=[...current];merged[index]={...old,primary:next.primary??old.primary,secondary:next.secondary??old.secondary};return merged;
}
// A model-specific bucket wins; otherwise the shared codex bucket, then the first one returned.
export function windowsFor(snapshots:LimitSnapshot[],model:string|null):LimitWindow[]{
  const bucket=snapshots.find(s=>model!==null&&s.normalModelSlug===model)??snapshots.find(s=>s.limitId==='codex')??snapshots[0];
  return bucket?[bucket.primary,bucket.secondary].filter(w=>w!==null):[];
}
