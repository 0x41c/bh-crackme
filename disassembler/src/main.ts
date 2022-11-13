import { existsSync, readFileSync, writeFileSync } from "fs";
import { Buffer } from "buffer";
import { exit } from "process";
import { Token } from "./basic/token";
import path = require("path");
import { parseTokens } from "./basic/parse";
import { format } from "prettier";

const programPath = path.join(__dirname, "../program.txt"); // TODO: Resolve this from a CLI or something
const configPath = path.join(__dirname, "../config.json");
const astDumpPath = path.join(__dirname, "../ast.json");
const jsDumpPath = path.join(__dirname, "../out.js");

{
  !existsSync(programPath) &&
    (console.error(`No program file: ${programPath}`), exit(69420));

  const instructions = (() => {
    const data = readFileSync(programPath, { encoding: "utf-8" });
    const binary = Buffer.from(data, "base64").toString("binary");
    return binary.split("").map((v) => v.charCodeAt(0));
  })();

  let config = (() => {
    let _config = JSON.parse(readFileSync(configPath, { encoding: "utf-8" }));

    for (let key of Object.keys(_config.instructionTypes))
      for (let instructionKey of _config.instructionTypes[key])
        _config.instructions[instructionKey].type = key;

    for (let key of Object.keys(_config.instructions))
      _config.instructions[key].configKey = key;

    return _config;
  })();

  const tokens = Token.tokenize(instructions, config);

  const ast = parseTokens(tokens);
  let astJSON = JSON.stringify(ast, null, 2);
  writeFileSync(astDumpPath, astJSON, { encoding: "utf-8" });

  const js = ast.stringRepresentation();
  writeFileSync(
    jsDumpPath,
    format(js, {
      tabWidth: 2,
      parser: "babel",
    }),
    { encoding: "utf-8" }
  );
}
