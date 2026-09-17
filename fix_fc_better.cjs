const fs = require("fs");
const path = require("path");

function processFile(filePath) {
    let content = fs.readFileSync(filePath, "utf8");
    let updated = content;

    // Replace any `const Name: React.FC< ... > =` or `const Name: React.FC =`
    // where everything between `:` and `=` is removed.
    updated = updated.replace(/const\s+([A-Z][a-zA-Z0-9_]*)\s*:\s*React\.FC\b[^=]*=/g, "const $1 =");

    if (updated !== content) {
        fs.writeFileSync(filePath, updated, "utf8");
        console.log("Updated:", filePath);
    }
}

function walk(dir) {
    if (!fs.existsSync(dir)) return;
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

fs.readdirSync(".").forEach(file => {
    if (file.endsWith(".tsx")) {
        processFile(file);
    }
});

walk("pages");
walk("components");
console.log("Done running fix_fc_better.cjs");
