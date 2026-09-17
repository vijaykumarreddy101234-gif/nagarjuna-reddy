const fs = require("fs");
let lines = fs.readFileSync("pages/ProfileSection.tsx", "utf8").split(/\r?\n/);

// Find `{type === 'list' && (` and clean up around line 335-345
for (let i = 315; i < 345; i++) {
    if (lines[i] && lines[i].includes("{type === 'list' &&")) {
        // scan forward for extra )
        for (let j = i + 1; j < i + 30; j++) {
            if (lines[j] && lines[j].trim() === ")}") {
                // check if it's extra
                lines.splice(j, 1);
                console.log("Removed extra ) at line", j+1);
                break;
            }
        }
    }
}

// Fix ternary close around ProfileMasterSpreadsheetGrid
for (let i = 3400; i < 3450; i++) {
    if (lines[i] && lines[i].trim() === ")}") {
        lines[i] = "                            )";
        console.log("Changed )}' to ')' at line", i+1);
        break;
    }
}

fs.writeFileSync("pages/ProfileSection.tsx", lines.join("\n"), "utf8");
console.log("Done fixing tags.");
