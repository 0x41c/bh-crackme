// -- Setup
const fs = require('fs');
let config = require('./config.json');
const { exit } = require('process');

!fs.existsSync('program.txt') && exit(69420);

const binary = Buffer.from(
    fs.readFileSync(
        'program.txt', {
            encoding: "utf8"
        }
    ), "base64"
).toString("binary")

const program = binary.split('').map((v) => v.charCodeAt(0));

// Lets assign the instruction type to the instruction itself for good measure eh?

{
    for (let key of Object.keys(config.instructionTypes))
        for (let instructionKey of config.instructionTypes[key])
            config.instructions[instructionKey].type = key;
}

// -- Utils

const copy = (obj) => Object.assign({}, obj);

const instToKey = (() => {
    let returnMap = {};
    for (const key of Object.keys(config.instructions))
        returnMap[config.instructions[key].opcode] = key;
    return returnMap;
})();


function readSplitNumber(startAddr, splits) {
    let number = 0, offset = 0;
    for (let i = splits - 1; i != -1; (i--, offset++))
    {
        let n = program[startAddr + offset] << (8 * i)
        if (i == splits -1) number = n;
        else number |= n;
    }
    return number;
}

const mathFunctions = {
    ADD: (a, b) => { return a + b },
    AND: (a, b) => { return a & b },
    GREATER_THAN: (a, b) => { return a > b},
    GREATER_THAN_OR_EQUAL: (a, b) => { return a >= b },
    LEFT_SHIFT: (a, b) => { return a << b },
    MODULUS: (a, b) => { return a % b },
    MULTIPLY: (a, b) => { return a * b },
    NOT_EQUAL: (a, b) => { return a != b },
    OR: (a, b) => { return a | b },
    RIGHT_SHIFT: (a, b) => { return a >> b },
    SMALLER_THAN: (a, b) => { return a < b },
    SMALLER_THAN_OR_EQUAL: (a, b) => { return a <= b },
    SQUARE: (a, b) => { return a ** b },
    SUBTRACT: (a, b) => { return a - b },
    XOR: (a, b) => { return a ^ b }
}

const logicalFunctions = {
    LOGICAL_NOT: (a) => { return a },
    NOT: (a) => { return ~a },
}


const ASTNodeType = {

    Program: {
        name: "Program",
        body: []
    },

    FunctionDecl: {
        name: "FunctionDecl",
        addr: 0,
        parameterCount: 0,
        UID: 0,
        body: [],
        head: null,
    },

    VariableDecl: {
        name: "VariableDecl",
        UID: 0,
        value: null
    },

    Literal: {
        name: "Literal",
        value: null
    },

    BinaryExpression: {
        name: "BinaryExpression",
        left: null,
        right: null,
        operator: ""
    },

    CallExpression: {
        name: "CallExpression",
        UID: 0
    }

};

// -- Dissassembly

{

    // -- Tokenization

    let programTokens = []

    for (let pointer = 0; pointer < program.length; pointer++)
    {
        
        let inst = program[pointer];
        let key = instToKey[inst];

        key || (console.error(`Invalid instruction "${inst}" (${pointer})`), exit());

        let token = copy(config.instructions[key]);

        token.address = pointer;
        token.argumentCount && (pointer += token.argumentCount);

        if (token.variableArguments)
        { // AKA: push immediate
            let type = program[++pointer];
            if (type == 0) 
                pointer += 4;
            else if (type == 1) 
                pointer += readSplitNumber(pointer + 1, 2) + 2;
        }
        
        // -- Token Parameterization
        if (token.parameterCount == 1)
        {
            if (!token.variableArguments)
                token.parameters = [readSplitNumber(token.address + 1, token.argumentCount)];
            else 
            { // push immediate
                let lptr = token.address;
                let type = program[++lptr];
                if (type == 0) token.parameters = [readSplitNumber(++lptr, 4)]
                else if (type == 1) 
                {
                    let length = readSplitNumber(++lptr, 2),
                        str = "";
                    lptr += 1; // offsetting
                    for (let i = 0; i < length; i++)
                        str += String.fromCharCode(program[++lptr]);
                    token.parameters = [str];
                }
                else if (type == 2) token.parameters = ["null"];
                else if (type == 3) token.parameters = ["{}"];
            }
        } else if (token.parameterCount == 2) 
            token.parameters = [program[token.address + 1], program[token.address + 2]];

        delete token.parameterCount;
        delete token.argumentCount;
        delete token.variableArguments;

        programTokens.push(token);
    }

    // Parsing

    let stack = [];
    let root = copy(ASTNodeType.Program);
    let currentNode = root;
    let idToNode = {};
    let ptr = 0;
    let finished = false;

    let inactiveConventions = Array.from(config.conventions);
    let activeConventions = [];

    const resetConvs = () => {
        activeConventions = [];
        inactiveConventions = Array.from(config.conventions);
    }

    const physicalAddrToVirt = (addr) => {
        for (var i = 0; i < programTokens.length; i++)
            if (programTokens[i].address == addr) return i;
        return -1;
    };

    let currentToken;
    while ((currentToken = programTokens[ptr], currentToken != null))
    {
        let jmpTaken = false;
        let skipConventions = [];

        for (let i = 0; i < inactiveConventions.length; i++)
        {
            let convention = inactiveConventions[i];
            if (activeConventions.includes(convention)) continue;

            let firstSeq = convention.sequence[0];
            let criteria = Object.keys(firstSeq)[0]
            let truth = firstSeq[criteria]

            if (criteria == "instruction" ? instToKey[currentToken.opcode] == truth : currentToken[criteria] == truth)
            {
                convention.hits = 1;
                convention.tokens = [currentToken];
                convention.sequence.length > 1 || skipConventions.push(convention.name);
                activeConventions.push(convention);
                inactiveConventions.splice(i, 1);
                i--;
            }
        }

        for (let i = 0; i < activeConventions.length; i++)
        {
            let convention = activeConventions[i];
            if (convention.name == "function_definition") debugger;
            if (skipConventions.includes(convention.name)) continue;

            let seq = convention.sequence.length == 1 
                    ? convention.sequence[0] 
                    : convention.sequence[convention.hits];
            let criteria = Object.keys(seq)[0];
            let truth = seq[criteria];

            if (criteria == "instruction" ? instToKey[currentToken.opcode] == truth : currentToken[criteria] == truth)
            {
                if (convention.sequence.length == 1 || convention.hits + 1 == convention.sequence.length)
                {
                    // Handle seq, reset convention seeking, possibly set new ptr.
                    resetConvs();

                    convention.tokens.push(currentToken);

                    // We can generate generic AST through recognizing patterns and understanding
                    // Stack allocations. Another parser will go through this generic AST and start applying
                    // More advanced stuff.

                    // A couple constants we'll need each time.
                    
                    let funcDecl                = copy(ASTNodeType.FunctionDecl),
                        variableDecl            = copy(ASTNodeType.VariableDecl),
                        literal                 = copy(ASTNodeType.Literal),
                        binaryExpressionDecl    = copy(ASTNodeType.BinaryExpression);

                    const genId = () => { 
                        let id = "";
                        for (var i = 0; i < 16; i++) id += Math.floor(Math.random() * 10);
                        return parseInt(id);
                    }
        
                    switch (convention.name) {

                        case "double_push_math": {
                            if (programTokens[ptr + 1] != null && programTokens[ptr + 1].name != "spc") 
                            {
                                let func = instToKey[convention.tokens[convention.tokens.length - 1].opcode];
                                literal.value = mathFunctions[func](
                                    convention.tokens[0].parameters[0],
                                    convention.tokens[1].parameters[0] 
                                );
                                variableDecl.UID = genId();
                                variableDecl.value = literal;
                                stack.push(variableDecl.UID);
                                idToNode[variableDecl.UID] = variableDecl;
                                currentNode.body.push(variableDecl);
                            }
                            else convention.tokens.push(programTokens[ptr + 1])
                        }
                        case "double_push_spc": {
                            let newPtr = convention.tokens[0].parameters[0] ^ convention.tokens[1].parameters[0];
                            let virt = physicalAddrToVirt(newPtr);
                            virt != -1 && (ptr = virt, jmpTaken = true)
                            break;
                        }

                        case "function_definition": {
                            funcDecl.UID = genId();
                            funcDecl.addr = convention.tokens[0].addr;
                            funcDecl.head = currentNode;
                            currentNode = funcDecl;
                            break;
                        }
                        default: console.error("Unknown convention: " + convention.name);
                    }

                    break;
                }
                convention.hits++;
                convention.tokens.push(currentToken);

            } else
            {
                inactiveConventions.push(convention);
                activeConventions.splice(i, 1);
            } 
        }

        jmpTaken || ptr++;

        if (finished) break;
    }

    debugger;
}
