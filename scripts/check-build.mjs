import fs from "node:fs";
import path from "node:path";
const args=process.argv.slice(2);
function value(flag){const i=args.indexOf(flag);return i>=0?args[i+1]:undefined;}
const scan=value("--scan"),sentinel=value("--sentinel");
const forbidden=[];for(let i=0;i<args.length;i++){if(args[i]==="--forbid-in"&&args[i+1])forbidden.push(args[++i]);}
if(!scan||!sentinel||!forbidden.length)throw new Error("Missing required build-check arguments.");
if(!fs.existsSync(scan))throw new Error("Build output directory is missing.");
const matches=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isSymbolicLink())throw new Error("Unexpected symlink in build output.");if(entry.isDirectory())walk(file);else if(fs.readFileSync(file).includes(Buffer.from(sentinel)))matches.push(file);}}
walk(scan);if(matches.length)throw new Error("AI sentinel found in build output: "+matches.join(", "));
for(const entry of forbidden){const split=entry.indexOf("=");if(split<1)throw new Error("Invalid --forbid-in argument.");const dir=entry.slice(0,split);const tokens=entry.slice(split+1).split(",").filter(Boolean);if(!fs.existsSync(dir))continue;const inspect=current=>{for(const item of fs.readdirSync(current,{withFileTypes:true})){const file=path.join(current,item.name);if(item.isDirectory())inspect(file);else{const data=fs.readFileSync(file,"utf8");for(const token of tokens)if(data.includes(token))throw new Error("Forbidden environment variable name found in client output.");}}};inspect(dir);}
const appManifest=path.join(scan,"server/app-paths-manifest.json");if(fs.existsSync(appManifest)){const routes=JSON.parse(fs.readFileSync(appManifest,"utf8"));if(Object.keys(routes).some(route=>/(^|\/)api(\/|$)/i.test(route)))throw new Error("API route found in build manifest.");}
const actionManifest=path.join(scan,"server/server-reference-manifest.json");if(fs.existsSync(actionManifest)){const actions=JSON.parse(fs.readFileSync(actionManifest,"utf8"));if(Object.values(actions).some(group=>group&&typeof group==="object"&&Object.keys(group).length>0))throw new Error("Server Action reference found in build manifest.");}
console.log("Build boundary check passed. Scanned "+scan+" and client assets under .next/static.");
