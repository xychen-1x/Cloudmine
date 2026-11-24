import "server-only";
const patterns:RegExp[]=[
 /\bgeo:-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?/gi,
 /@-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g,
 /\b(?:lat(?:itude)?\s*[:=]\s*)-?\d{1,3}(?:\.\d+)?\s*[,;\/]\s*(?:lon(?:gitude)?|lng)\s*[:=]?\s*-?\d{1,3}(?:\.\d+)?/gi,
 /\b-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}\b/g,
 /\b\d{1,3}\s*°[^\n,;]*[NS]\s*[,;]\s*\d{1,3}\s*°[^\n,;]*[EW]/gi,
 /\b-?\d{1,3}(?:\.\d+)?\s*[NS]\s*[,;]\s*-?\d{1,3}(?:\.\d+)?\s*[EW]/gi
];
export function redactCoordinates(value:string):string{return patterns.reduce((s,p)=>s.replace(p,"[location coordinates removed]"),value);}
export function sanitizeUserText(value:string,maxLength=1000):string{return redactCoordinates(value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g," ").trim()).slice(0,maxLength);}
