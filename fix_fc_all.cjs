const fs = require("fs");
const path = require("path");

function processFile(filePath) {
    let content = fs.readFileSync(filePath, "utf8");
    let updated = content;

    // Replace `const Name: React.FC<...> =` or `const Name: React.FC =`
    // with `const Name =`
    // Regex matches: const [A-Z][a-zA-Z0-9_]*\s*:\s*React\.FC(<[^>]*>)?\s*=
    updated = updated.replace(/const\s+([A-Z][a-zA-Z0-9_]*)\s*:\s*React\.FC(?:<[^>]*>)?\s*=/g, "const $1 =");

    if (updated !== content) {
        fs.writeFileSync(filePath, updated, "utf8");
        console.log("Updated:", filePath);
    }
}

function walk(dir) {
    fs.readdirSync(dir).forEach(file => {
        let full = path.join(dir, file);
        let stat = fs.statSync(full);
        if (stat.isDirectory()) {
            if (file !== "node_modules" && file !== "dist" && file !== ".git") {
                walk(full);
            }
        } else if (full.endsWith(".tsx")) {
            processFile(full);
        }
    });
}

// Process root .tsx files
fs.readdirSync(".").forEach(file => {
    if (file.endsWith(".tsx")) {
        processFile(file);
    }
});

walk("pages");
if (fs.existsSync("components")) walk("components");
console.log("Done removing React.FC annotations.");
