const fs = require("fs");
let lines = fs.readFileSync("pages/ProfileSection.tsx", "utf8").split(/\r?\n/);

for (let i = 315; i < 345; i++) {
    if (lines[i] && lines[i].includes("{type === 'list' &&")) {
        for (let j = i + 1; j < i + 30; j++) {
            if (lines[j] && lines[j].trim() === ")}") {
                lines.splice(j, 1);
                console.log("Removed extra ) at line", j+1);
                break;
            }
        }
    }
}

for (let i = 3400; i < 3450; i++) {
    if (lines[i] && lines[i].trim() === ")}") {
        lines[i] = "                            )";
        console.log("Changed )}' to ')' at line", i+1);
        break;
    }
}

fs.writeFileSync("pages/ProfileSection.tsx", lines.join("\n"), "utf8");
console.log("Done fixing tags.");
