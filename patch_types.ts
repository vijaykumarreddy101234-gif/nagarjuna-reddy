import fs from 'fs';
let content = fs.readFileSync('types.ts', 'utf-8');
content = content.replace("export type Page = 'Dashboard' | 'RM Section' | 'Profile Section' | 'Dies & Planning' | 'History' | 'Storage' | 'Import' | 'Trash' | 'Workspace AI';", "export type Page = 'Dashboard' | 'RM Section' | 'Profile Section' | 'Dies & Planning' | 'History' | 'Storage' | 'Import' | 'Trash' | 'Workspace AI' | 'Settings';");

if (!content.includes('export interface AppUser')) {
    content += `\nexport interface AppUser {\n  id: string;\n  email: string;\n  name: string;\n  role: Role;\n  allowedPages: Page[];\n  createdAt: string;\n}\n`;
}
fs.writeFileSync('types.ts', content);
