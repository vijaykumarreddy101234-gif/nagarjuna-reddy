import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const clientIdRoute = `
  app.get("/api/config/google", (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
  });
`;

content = content.replace('// Vite middleware for development', clientIdRoute + '\n  // Vite middleware for development');
fs.writeFileSync('server.ts', content);
