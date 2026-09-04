import fs from 'fs';

let content = fs.readFileSync('App.tsx', 'utf-8');

// Change sidebar name from Mails to Workspace AI
content = content.replace("{ name: 'Mails', shortcut: 'm' }", "{ name: 'Workspace AI', shortcut: 'm' }");
content = content.replace("currentPage === 'Mails'", "currentPage === 'Workspace AI'");

fs.writeFileSync('App.tsx', content);
