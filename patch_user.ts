import fs from 'fs';
let content = fs.readFileSync('types.ts', 'utf-8');
content = content.replace("export interface User {", "export interface User {\n  provider?: string;");
fs.writeFileSync('types.ts', content);
