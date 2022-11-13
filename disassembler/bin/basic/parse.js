"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTokens = void 0;
const ast_1 = require("./ast");
const token_1 = require("./token");
let identToFunction = {};
let identToVariable = {};
class _tokenParser {
    constructor(tokens, depth) {
        this.checkedAddresses = [];
        this.physicalAddrToVirt = [];
        this.idx = 0;
        this.didJump = false;
        this.depth = 0;
        // TODO: Dynamic memory allocation for stacks.
        this.variableNameStack = new Array(3000).fill(0);
        this.functionNameStack = new Array(3000).fill(0);
        this.stackState = [];
        this.currentBlock = [];
        this.blockEnd = false;
        this.exitBlock = () => (this.blockEnd = true);
        this.tokens = tokens;
        for (let token of this.tokens)
            this.physicalAddrToVirt[token.address] = token;
        depth && (this.depth = depth);
    }
    get eof() {
        return this.idx >= this.tokens.length;
    }
    // We shouldn't overflow here because of external checks
    get curr() {
        return this.tokens[this.idx];
    }
    get nextVarName() {
        return `var${++this.variableNameStack[this.depth]}`;
    }
    get nextFuncName() {
        return `func${++this.functionNameStack[this.depth]}`;
    }
    delVarName(number = 1) {
        this.variableNameStack[this.depth] -= number;
    }
    delFuncName(number = 1) {
        this.functionNameStack[this.depth] -= number;
    }
    last(offset = 0) {
        if (this.idx >= 1)
            return this.tokens[this.idx - (offset + 1)];
        return null;
    }
    bump() {
        return this.tokens[++this.idx];
    }
    redact(amount = 1) {
        let nodes = this.currentBlock.splice(this.currentBlock.length - amount);
        for (let node of nodes) {
            if (node.type == ast_1._AST_Type.VariableDecl)
                this.delVarName();
            else if (node.type == ast_1._AST_Type.FunctionDecl)
                this.delFuncName();
        }
    }
    jumpToAddr(physicalAddr) {
        let newTok = this.physicalAddrToVirt[physicalAddr];
        if (newTok != null)
            this.idx = this.tokens.indexOf(newTok);
        else
            this.exitBlock();
        this.didJump = true;
    }
    defineVar(node) {
        let decl = new ast_1.VariableDeclaration(node, this.nextVarName);
        this.stackState.push(decl.declaration.id);
        identToVariable[decl.declaration.id.name] = decl;
        return decl;
    }
    enterNextScope(address, stack) {
        let ndepth = this.depth + 1;
        let parser = new _tokenParser(this.tokens, ndepth);
        parser.variableNameStack[ndepth] = this.variableNameStack[this.depth];
        parser.functionNameStack[ndepth] = this.functionNameStack[this.depth];
        parser.stackState = stack;
        parser.jumpToAddr(address);
        parser.didJump = false;
        parser.checkedAddresses = this.checkedAddresses;
        let blk = parser.visitBlockBody();
        let newAddresses = parser.checkedAddresses;
        newAddresses = newAddresses.filter((v) => !this.checkedAddresses.includes(v));
        this.checkedAddresses.push(...newAddresses);
        return blk;
    }
    visitNext() {
        if (this.checkedAddresses.includes(this.curr.address))
            return;
        this.checkedAddresses.push(this.curr.address);
        switch (this.curr.type) {
            case token_1.TokenType.STACK:
                let specialCases = [
                    "CLEAR_STACK",
                    "DEFLATE_STACK",
                    "INFLATE_STACK",
                    "POP_STACK",
                    "REVERSE_STACK",
                ];
                if (!specialCases.includes(this.curr.configKey))
                    return this.visitStackVarDecl();
                else
                    this.evalStackMutators();
                return null;
            case token_1.TokenType.MATH:
                return this.visitMathVarDecl();
            case token_1.TokenType.CONTROL_FLOW:
                return this.visitControlFlow();
            case token_1.TokenType.FUNCTION:
                return this.visitFunction();
            case token_1.TokenType.VARIABLE:
                return this.visitVariable();
            case token_1.TokenType.ARRAY:
                return this.visitArrayOperation();
            case token_1.TokenType.MISC:
                return this.visitJSONStringify();
        }
    }
    visitJSONStringify() {
        let memberExpr = new ast_1.MemberExpression(// TODO: Properly join identifiers
        new ast_1.Identifier("JSON"), new ast_1.Identifier("stringify"));
        let callExpr = new ast_1.CallExpression(memberExpr, [this.stackState.pop()]);
        return new ast_1.ExpressionStatement(callExpr);
    }
    visitArrayOperation() {
        switch (this.curr.configKey) {
            case "ASSIGN_ARRAY":
                return this.visitArrayAssignExpr();
            case "CREATE_ARRAY":
                return this.visitArrayCreationExpr();
            case "SUBSCRIPT_ARRAY":
                return this.visitArraySubscExpr();
        }
    }
    visitArrayAssignExpr() {
        let objId = this.stackState.pop();
        let subScriptId = this.stackState.pop();
        let valueId = this.stackState.pop();
        if (objId.name != "variables") {
            let decl = identToVariable[objId.name];
            let memberExpr = decl.declaration.init;
            let realObjId = memberExpr.object;
            if (realObjId.type == ast_1._AST_Type.Identifier) {
                let firstSubId = memberExpr.property;
                let secondSubId = subScriptId;
                let obj;
                if (!Object.keys(identToVariable).includes(realObjId.name))
                    obj = realObjId;
                else
                    obj = identToVariable[realObjId.name].declaration.init;
                let sub1;
                if (firstSubId.type == ast_1._AST_Type.Literal)
                    sub1 = firstSubId;
                else
                    sub1 = identToVariable[firstSubId.name].declaration.init;
                let sub2 = identToVariable[secondSubId.name].declaration
                    .init;
                this.redact(4);
                let memberExpr1 = new ast_1.MemberExpression(obj, sub1);
                let memberExpr2 = new ast_1.MemberExpression(memberExpr1, sub2);
                let assignmentExpr = new ast_1.AssignmentExpression("=", memberExpr2, valueId);
                return new ast_1.ExpressionStatement(assignmentExpr);
            }
        }
        let memberExpr = new ast_1.MemberExpression(objId, subScriptId);
        let assignExpr = new ast_1.AssignmentExpression("=", memberExpr, valueId);
        return new ast_1.ExpressionStatement(assignExpr);
    }
    visitArrayCreationExpr() {
        let length = this.curr.parameters[0];
        let ids = [];
        while (length-- != 0)
            ids.push(this.stackState.pop());
        let arrExpr = new ast_1.ArrayExpression(ids);
        return this.defineVar(arrExpr);
    }
    visitArraySubscExpr() {
        let id = this.stackState.pop();
        let subScriptId = this.stackState.pop();
        if (id.name != "variables") {
            let obj = identToVariable[id.name];
            let subScrpVar;
            if (subScriptId == null)
                subScrpVar = new ast_1.Identifier("UNKNOWN");
            else
                subScrpVar = identToVariable[subScriptId.name].declaration.init;
            let arrExpr = new ast_1.MemberExpression(obj.declaration.init, subScrpVar);
            return this.defineVar(arrExpr);
        }
        let arrExpr = new ast_1.MemberExpression(id, subScriptId);
        return this.defineVar(arrExpr);
    }
    visitVariable() {
        switch (this.curr.configKey) {
            case "STORE_IN_VARIABLE":
                return this.visitVariableStore();
            case "LOAD_FROM_VARIABLE":
                return this.visitVariableLoad();
        }
    }
    // TODO: Disambiguate the use of "variables"
    visitVariableStore() {
        let memberExpr1 = new ast_1.MemberExpression(new ast_1.Identifier("variables"), new ast_1.Literal(this.curr.parameters[0]));
        let memberExpr2 = new ast_1.MemberExpression(memberExpr1, new ast_1.Literal(this.curr.parameters[1]));
        let assignmentExpr = new ast_1.AssignmentExpression("=", memberExpr2, this.stackState.pop());
        return new ast_1.ExpressionStatement(assignmentExpr);
    }
    visitVariableLoad() {
        let memberExpr1 = new ast_1.MemberExpression(new ast_1.Identifier("variables"), new ast_1.Literal(this.curr.parameters[0]));
        let memberExpr2 = new ast_1.MemberExpression(memberExpr1, new ast_1.Literal(this.curr.parameters[1]));
        return this.defineVar(memberExpr2);
    }
    visitFunction() {
        switch (this.curr.configKey) {
            case "CALL_FUNCTION_IN_STACK":
                return this.visitFunctionCallsite();
            case "DEFINE_FUNCTION_START":
                return this.visitFunctionDeclaration();
            case "EXIT_FUNCTION": // This is actually "exit(popStack());"
                this.exitBlock();
                return new ast_1.ReturnStatement(this.stackState.pop());
        }
    }
    visitFunctionCallsite() {
        let paramCount = this.curr.parameters[0];
        // Fill in function values
        let functionIdent = this.stackState[this.stackState.length - paramCount - 1];
        let funcDecl = identToFunction[functionIdent.name];
        if (funcDecl) {
            funcDecl.paramCount = paramCount;
            let simStack = [];
            for (let i = 0; i < paramCount; i++)
                simStack.push(new ast_1.Identifier(`arg${i}`));
            funcDecl.block.body = this.enterNextScope(funcDecl.startAddr, simStack);
        }
        // Return to call site.
        let args = [];
        for (let i = this.stackState.length - paramCount; i < this.stackState.length; i++)
            args.push(this.stackState[i]);
        let callExpr = new ast_1.CallExpression(functionIdent, args);
        let exprStatement = new ast_1.ExpressionStatement(callExpr);
        return this.defineVar(exprStatement);
    }
    visitFunctionDeclaration() {
        let decl = new ast_1.FunctionDeclaration(this.curr.address + 4, 0, this.nextFuncName);
        this.stackState.push(decl.id);
        decl.jmpAddr = this.curr.parameters[0];
        this.jumpToAddr(decl.jmpAddr);
        identToFunction[decl.id.name] = decl;
        return decl;
    }
    visitControlFlow() {
        switch (this.curr.configKey) {
            case "LOAD_PC":
                return this.visitConditionalJump();
            case "SET_PC":
                this.visitUnconditionalJump();
                break;
            case "THROW":
            case "THROW_STACK_POP":
                return this.visitThrowStatement();
        }
    }
    visitThrowStatement() {
        // Throws are a joke lmao
        let catchAddr = this.last().parameters[0];
        this.stackState.push(this.stackState[this.stackState.length - 1]);
        this.jumpToAddr(catchAddr);
        return;
    }
    visitUnconditionalJump() {
        let [a, b] = [this.last(1).parameters[0], this.last(2).parameters[0]];
        this.jumpToAddr(a ^ b);
        this.redact(3);
        this.stackState.pop();
        return;
    }
    visitConditionalJump() {
        let index = this.idx;
        let token;
        let tokens = [];
        while (((token = this.tokens[index++]),
            tokens.push(token),
            token.configKey != "SET_PC"))
            ;
        let conditionId = this.stackState[this.stackState.length - 1];
        let startAddr = tokens[0].address;
        let endAddr = (tokens[2].parameters[0] ^ tokens[3].parameters[0]) + startAddr;
        let rel1 = (tokens[7].parameters[0] ^ tokens[8].parameters[0]) - startAddr;
        let rel2 = rel1 - (tokens[11].parameters[0] ^ tokens[12].parameters[0]);
        let consequentAddr = rel2 + endAddr;
        let consequentBlock = new ast_1.BlockStatement([]);
        consequentBlock.body = this.enterNextScope(consequentAddr, [
            ...this.stackState,
        ]);
        this.jumpToAddr(endAddr);
        return new ast_1.IfStatement(conditionId, consequentBlock);
    }
    visitStackVarDecl() {
        let init = null;
        switch (this.curr.configKey) {
            case "COPY":
                init = this.stackState[this.stackState.length - 1];
                break;
            case "PUSH_IMMEDIATE":
                init = new ast_1.Literal(this.curr.parameters[0]); // A single immediate is provided
                if (init.value == "Function")
                    break;
                break;
            case "PUSH_INTERPRETER_TO_STACK":
                init = new ast_1.Identifier("interpreter");
                break;
            case "PUSH_VARS_TO_STACK":
                init = new ast_1.Identifier("variables");
                break;
            case "PUSH_WINDOW":
                init = new ast_1.Identifier("globalThis");
                break;
            case "PUSH_CATCH_POINTER":
                return; // Special case for throwing
        }
        return this.defineVar(init);
    }
    evalStackMutators() {
        switch (this.curr.configKey) {
            case "CLEAR_STACK":
                this.stackState = [];
                break;
            case "DEFLATE_STACK":
                for (var i = this.curr.parameters[0]; this.stackState.length > i;)
                    this.stackState.pop();
                break;
            case "INFLATE_STACK":
                for (var i = this.curr.parameters[0]; this.stackState.length < i;)
                    this.stackState.push(void 0);
                break;
            case "POP_STACK":
                this.stackState.pop();
                break;
            case "REVERSE_STACK":
                var [swapCount, stackLength] = [
                    this.curr.parameters[0],
                    this.stackState.length - 1,
                ];
                if (2 == swapCount) {
                    [this.stackState[stackLength], this.stackState[stackLength - 1]] = [
                        this.stackState[stackLength - 1],
                        this.stackState[stackLength],
                    ];
                }
                else {
                    for (var c = [], d = 0; d < swapCount; d++)
                        c.push(this.stackState.pop());
                    this.stackState.push(...c);
                }
                break;
        }
    }
    visitMathVarDecl() {
        let operator = "";
        switch (this.curr.configKey) {
            case "ADD":
                operator = "+";
            case "AND":
                operator = "&";
            case "GREATER_THAN":
                operator = ">";
            case "GREATER_THAN_OR_EQUAL":
                operator = "> = ";
            case "LEFT_SHIFT":
                operator = "<<";
            case "LOGICAL_NOT":
                operator = "!";
            case "MODULUS":
                operator = "%";
            case "MULTIPLY":
                operator = "*";
            case "NOT_EQUAL":
                operator = "!=";
            case "OR":
                operator = "|";
            case "RIGHT_SHIFT":
                operator = ">>";
            case "SMALLER_THAN":
                operator = "<";
            case "SMALLER_THAN_OR_EQUAL":
                operator = "<=";
            case "SQUARE":
                operator = "**";
            case "SUBTRACT":
                operator = "-";
            case "XOR":
                operator = "^";
        }
        if (operator == "") {
            if (this.curr.configKey == "NOT" ||
                this.curr.configKey == "LOGICAL_NOT") {
                let unaryExpr = new ast_1.UnaryExpression(this.curr.configKey == "NOT" ? "~" : "~", true, this.stackState.pop());
                let exprStatement = new ast_1.ExpressionStatement(unaryExpr);
                return this.defineVar(exprStatement);
            }
            else
                return null;
        }
        let binaryExpr = new ast_1.BinaryExpression(operator, this.stackState.pop(), this.stackState.pop());
        let exprStatement = new ast_1.ExpressionStatement(binaryExpr);
        return this.defineVar(exprStatement);
    }
    visitProgram() {
        this.program = new ast_1.Program();
        this.program.block.body = this.visitBlockBody();
        return this.program;
    }
    visitBlockBody() {
        this.currentBlock = [];
        while (!this.eof && !this.blockEnd) {
            let next = this.visitNext();
            next && this.currentBlock.push(next);
            !this.didJump ? this.bump() : (this.didJump = false);
        }
        return this.currentBlock;
    }
}
function parseTokens(tokens) {
    let parser = new _tokenParser(tokens);
    return parser.visitProgram();
}
exports.parseTokens = parseTokens;
