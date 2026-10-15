import type {Readable} from 'node:stream';

export const MOUSE_ON='\x1b[?1000h\x1b[?1006h';
export const MOUSE_OFF='\x1b[?1006l\x1b[?1000l';

// Intercept read(), not data events: Ink consumes readable chunks before dispatching keys or paste.
export function transcriptInput(stdin:Pick<Readable,'read'|'emit'>,stdout:NodeJS.WritableStream,scroll:(direction:number,page:boolean)=>void){
  const original=stdin.read;let pending='';let queued='';let timer:ReturnType<typeof setTimeout>|undefined;
  const tty='isTTY'in stdout&&stdout.isTTY;
  const flush=()=>{timer=undefined;queued+=pending;pending='';stdin.emit('readable');};
  stdin.read=function(size?:number){
    let output=queued;queued='';let chunk:unknown;
    while((chunk=original.call(stdin,size))!==null){
      let text=pending+String(chunk);pending='';if(timer){clearTimeout(timer);timer=undefined;}
      while(text){
        const at=text.indexOf('\x1b');
        if(at<0){output+=text;break;}
        output+=text.slice(0,at);text=text.slice(at);
        const mouse=/^\x1b\[<(\d+);(\d+);(\d+)([Mm])/.exec(text);
        if(mouse){if(mouse[4]==='M'&&(mouse[1]==='64'||mouse[1]==='65'))scroll(mouse[1]==='64'?-1:1,false);text=text.slice(mouse[0].length);continue;}
        const page=/^\x1b\[(5|6)~/.exec(text);
        if(page){scroll(page[1]==='5'?-1:1,true);text=text.slice(page[0].length);continue;}
        if(/^\x1b\[<[\d;]*$/.test(text)){
          // A definite mouse prefix can span slow chunks; never flush it as typed text.
          pending=text.slice(0,128);break;
        }
        if(['\x1b','\x1b[','\x1b[5','\x1b[6'].includes(text)){pending=text;timer=setTimeout(flush,20);break;}
        output+=text[0];text=text.slice(1);
      }
    }
    return output||null;
  };
  const restore=()=>{if(timer)clearTimeout(timer);pending='';queued='';stdin.read=original;if(tty)try{stdout.write(MOUSE_OFF);}catch{}};
  try{if(tty)stdout.write(MOUSE_ON);}catch(error){restore();throw error;}
  return restore;
}
