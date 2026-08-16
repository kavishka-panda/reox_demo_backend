// backend/bundle.js (modified)
const esbuild = require("esbuild");
const JavaScriptObfuscator = require("javascript-obfuscator");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

(async () => {
    try {
        // 1. Generate a fresh key file
        require("./generate-env-key"); // writes envKey.js

        // 2. Encrypt .env → .env.enc using the key just generated
        const { ENV_KEY, ENV_IV } = require("./envKey");
        const crypto = require("crypto");
        const envData = fs.readFileSync(path.join(__dirname, ".env"));
        const cipher = crypto.createCipheriv(
            "aes-256-cbc",
            Buffer.from(ENV_KEY, "hex"),
            Buffer.from(ENV_IV, "hex")
        );
        const encrypted = Buffer.concat([cipher.update(envData), cipher.final()]);
        fs.writeFileSync(path.join(__dirname, ".env.enc"), encrypted);
        console.log("✅ .env encrypted to .env.enc");

        // 3. Bundle with esbuild (as before)
        await esbuild.build({
            entryPoints: ["index.js"],
            bundle: true,
            platform: "node",
            target: "node20",
            outfile: "dist/server.js",
            minify: true,
            external: [
                "@prisma/client",
                "prisma",
                "better-sqlite3",
                "bcrypt"
            ]
        });

        // 4. Obfuscate the bundle (as before)
        const code = fs.readFileSync("dist/server.js", "utf8");
        const result = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            deadCodeInjection: true,
            stringArray: true,
            selfDefending: true
        });
        fs.writeFileSync("dist/server.js", result.getObfuscatedCode());

        console.log("✅ Backend bundled and obfuscated successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Backend bundling failed:", error);
        process.exit(1);
    }
})();