import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const importStatement = 'import { GoogleGenAI } from "@google/genai";\n';
if (!content.includes('GoogleGenAI')) {
    content = importStatement + content;
}

const aiRoute = `
  app.post("/api/ai/workspace", async (req, res) => {
    try {
      const { token, query } = req.body;
      if (!token) {
        return res.status(401).json({ error: "No Workspace token provided" });
      }
      
      // 1. Fetch from Gmail
      let emailContext = "";
      try {
        const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5", {
          headers: { Authorization: \`Bearer \${token}\` }
        });
        if (gmailRes.ok) {
          const gmailData = await gmailRes.json();
          if (gmailData.messages && gmailData.messages.length > 0) {
            const snippets = await Promise.all(
              gmailData.messages.slice(0, 5).map(async (msg: any) => {
                const msgRes = await fetch(\`https://gmail.googleapis.com/gmail/v1/users/me/messages/\${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From\`, {
                  headers: { Authorization: \`Bearer \${token}\` }
                });
                const msgData = await msgRes.json();
                const headers = msgData.payload?.headers || [];
                const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
                const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
                return \`From: \${from}\\nSubject: \${subject}\\nSnippet: \${msgData.snippet}\`;
              })
            );
            emailContext = "RECENT EMAILS:\\n" + snippets.join("\\n\\n");
          }
        }
      } catch (e) {
        console.error("Gmail fetch error", e);
      }

      // 2. Fetch from Drive
      let driveContext = "";
      try {
        const driveRes = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(name,mimeType)", {
          headers: { Authorization: \`Bearer \${token}\` }
        });
        if (driveRes.ok) {
          const driveData = await driveRes.json();
          if (driveData.files && driveData.files.length > 0) {
            const filesList = driveData.files.map((f: any) => \`- \${f.name} (\${f.mimeType})\`).join("\\n");
            driveContext = "RECENT DRIVE FILES:\\n" + filesList;
          }
        }
      } catch (e) {
        console.error("Drive fetch error", e);
      }

      const promptContext = \`
You are a helpful AI Assistant connected to the user's workspace.
Below is the context from their recent emails and drive files. Use this information to answer their query.
If their query is about general knowledge or outside this context, use your Google Search tool to find the answer.

\${emailContext}

\${driveContext}

USER QUERY: \${query}
\`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptContext,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      
      res.json({ answer: response.text });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process AI request" });
    }
  });

`;

content = content.replace('// Vite middleware for development', aiRoute + '\n  // Vite middleware for development');
fs.writeFileSync('server.ts', content);
