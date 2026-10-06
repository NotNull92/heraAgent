import {stripVTControlCharacters} from 'node:util';
export class HeraError extends Error {
  constructor(readonly errorCode: string, message: string, readonly exitCode = 5, readonly outcomeKnown = true, readonly retryable = false) {super(message);}
}
export function safeText(value: string): string {
  return stripVTControlCharacters(value).replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '').replace(/(?:gh[pousr]_[\w]{20,}|sk-[\w-]{20,}|Bearer\s+[^\s"']+)/gi, '[REDACTED]');
}
export function errorView(error: unknown) {
  const e = error instanceof HeraError ? error : new HeraError('EXECUTION_FAILED', error instanceof Error ? error.message : 'Unknown failure',5,false);
  return {errorCode:e.errorCode,message:safeText(e.message),retryable:e.retryable,outcomeKnown:e.outcomeKnown,exitCode:e.exitCode};
}
