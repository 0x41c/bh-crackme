"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const buffer_1 = require("buffer");
const process_1 = require("process");
const token_1 = require("./basic/token");
const path = require("path");
const parse_1 = require("./basic/parse");
const prettier_1 = require("prettier");
const programPath = path.join(__dirname, "../program.txt"); // TODO: Resolve this from a CLI or something
const configPath = path.join(__dirname, "../config.json");
const astDumpPath = path.join(__dirname, "../ast.json");
const jsDumpPath = path.join(__dirname, "../out.js");
{
    !(0, fs_1.existsSync)(programPath) &&
        (console.error(`No program file: ${programPath}`), (0, process_1.exit)(69420));
    const instructions = (() => {
        const data = (0, fs_1.readFileSync)(programPath, { encoding: "utf-8" });
        const binary = buffer_1.Buffer.from(data, "base64").toString("binary");
        return binary.split("").map((v) => v.charCodeAt(0));
    })();
    let config = (() => {
        let _config = JSON.parse((0, fs_1.readFileSync)(configPath, { encoding: "utf-8" }));
        for (let key of Object.keys(_config.instructionTypes))
            for (let instructionKey of _config.instructionTypes[key])
                _config.instructions[instructionKey].type = key;
        for (let key of Object.keys(_config.instructions))
            _config.instructions[key].configKey = key;
        return _config;
    })();
    const tokens = token_1.Token.tokenize(instructions, config);
    const ast = (0, parse_1.parseTokens)(tokens);
    let astJSON = JSON.stringify(ast, null, 2);
    (0, fs_1.writeFileSync)(astDumpPath, astJSON, { encoding: "utf-8" });
    const js = ast.stringRepresentation();
    (0, fs_1.writeFileSync)(jsDumpPath, (0, prettier_1.format)(js, {
        tabWidth: 2,
        parser: "babel",
    }), { encoding: "utf-8" });
}
