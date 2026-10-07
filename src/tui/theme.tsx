import React,{createContext,useContext} from 'react';
import {Box,Text as InkText,useAnimation} from 'ink';
import type {TextProps} from 'ink';

// Nordic-fantasy presentation: iron rules, gold diamond ornaments and the three HUD bar hues.
// Body text keeps the terminal's own foreground so light and dark profiles both stay readable.
const hues={gold:'#c8a45a',iron:'#7d8590',frost:'#8fbcd4',blood:'#c0503f',moss:'#6fa86a'} as const;
export type Palette={[K in keyof typeof hues]:string|undefined};
// NO_COLOR and ui.color=never drop every hue; glyphs and bold still carry the meaning.
export const palette=(color:'auto'|'never',env:NodeJS.ProcessEnv=process.env):Palette=>{const plain=color==='never'||!!env.NO_COLOR;return Object.fromEntries(Object.entries(hues).map(([name,hex])=>[name,plain?undefined:hex])) as Palette;};
export type Theme={c:Palette;motion:boolean};
export const ThemeContext=createContext<Theme>({c:palette('auto'),motion:true});
export const useTheme=()=>useContext(ThemeContext);
// Ink rejects an explicit undefined color, so a colorless palette omits the prop instead.
const tint=(color:string|undefined)=>color?{color}:{};
export function Text({color,...rest}:Omit<TextProps,'color'>&{color?:string|undefined}){return <InkText {...rest} {...tint(color)}/>;}

// A horizontal rule that fills the remaining row width without measuring wide characters.
export function Rule({heavy=false}:{heavy?:boolean}){
  const {c}=useTheme();
  return <Box flexGrow={1} minWidth={1} borderStyle={heavy?'bold':'single'} borderTop={false} borderLeft={false} borderRight={false} {...(c.iron?{borderColor:c.iron}:{})}/>;
}
// Colors ornament glyphs inside otherwise plain decorative text.
export function Ornate({text,bold=false}:{text:string;bold?:boolean}){
  const {c}=useTheme();
  return <Text bold={bold}>{text.split(/(◆|[◇━─╾╼┥┝]+)/).map((part,i)=>i%2?<Text key={i} bold={false} color={part==='◆'?c.gold:c.iron}>{part}</Text>:part)}</Text>;
}
// Forged frame: heavy rules, light sides, gold corner studs and the title set into the top edge.
export function Frame({title,height,children}:{title:string;height?:number;children:React.ReactNode}){
  const {c}=useTheme();
  return <Box flexDirection="column">
    <Box><Ornate text="◆━┥ "/><Box flexShrink={1}><Text bold wrap="truncate-end">{title}</Text></Box><Ornate text=" ┝"/><Rule heavy/><Ornate text="◆"/></Box>
    <Box borderStyle="single" borderTop={false} borderBottom={false} {...(c.iron?{borderColor:c.iron}:{})} flexDirection="column" paddingX={1} height={height} overflow="hidden">{children}</Box>
    <Box><Ornate text="◆"/><Rule heavy/><Ornate text="◆"/></Box>
  </Box>;
}
// Activity mark: a gold stud travels while work is active; it never implies measured progress.
export function Glint({active}:{active:boolean}){
  const {c,motion}=useTheme();const {frame}=useAnimation({interval:160,isActive:active&&motion});
  if(!active)return <Text color={c.iron}>◇◇◇</Text>;
  const at=motion?[0,1,2,1][frame%4]:1;
  return <Text color={c.gold}>{[0,1,2].map(i=>i===at?'◆':'◇').join('')}</Text>;
}
