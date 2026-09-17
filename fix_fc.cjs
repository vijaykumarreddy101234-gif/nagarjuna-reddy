const fs = require("fs");
let content = fs.readFileSync("pages/ProfileSection.tsx", "utf8");

// Remove : React.FC<...> globally across any component definition
content = content.replace(/const\s+([a-zA-Z0-9_]+)\s*:\s*React\.FC\s*<[^>]*>/g, "const $1");
content = content.replace(/const\s+([a-zA-Z0-9_]+)\s*:\s*React\.FC\s*<\s*\{[\s\S]*?\}\s*>/g, "const $1");
content = content.replace(/const\s+([a-zA-Z0-9_]+)\s*:\s*React\.FC\b/g, "const $1");

fs.writeFileSync("pages/ProfileSection.tsx", content, "utf8");
console.log("Removed all React.FC annotations.");


