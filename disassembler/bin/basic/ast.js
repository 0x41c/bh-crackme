"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThrowStatement = exports.ReturnStatement = exports.IfStatement = exports.FunctionDeclaration = exports.VariableDeclaration = exports.VariableDeclarationKind = exports.VariableDeclarator = exports.ExpressionStatement = exports.ArrayExpression = exports.CallExpression = exports.UnaryExpression = exports.BinaryExpression = exports.AssignmentExpression = exports.MemberExpression = exports.Identifier = exports.Literal = exports.Program = exports.TryStatement = exports.CatchClause = exports.BlockStatement = exports.Unknown = exports._AST_Type = void 0;
var _AST_Type;
(function (_AST_Type) {
    _AST_Type["Program"] = "Program";
    _AST_Type["Literal"] = "Literal";
    _AST_Type["Identifier"] = "Identifier";
    // Statements
    _AST_Type["BlockStatement"] = "BlockStatement";
    _AST_Type["ExpressionStatement"] = "ExpressionStatement";
    _AST_Type["IfStatement"] = "IfStatement";
    _AST_Type["ReturnStatement"] = "ReturnStatement";
    _AST_Type["TryStatement"] = "TryStatement";
    _AST_Type["ThrowStatement"] = "ThrowStatement";
    // Declarations
    _AST_Type["VariableDecl"] = "VariableDecl";
    _AST_Type["VariableDeclarator"] = "VariableDeclarator";
    _AST_Type["FunctionDecl"] = "FunctionDecl";
    // Expressions
    _AST_Type["ArrayExpression"] = "ArrayExpression";
    _AST_Type["AssignmentExpression"] = "AssignmentExpression";
    _AST_Type["MemberExpression"] = "MemberExpression";
    _AST_Type["BinaryExpression"] = "BinaryExpression";
    _AST_Type["UnaryExpression"] = "UnaryExpression";
    _AST_Type["CallExpression"] = "CallExpression";
    _AST_Type["CatchClause"] = "CatchClause";
    _AST_Type["Unknown"] = "Unknown";
})(_AST_Type = exports._AST_Type || (exports._AST_Type = {}));
class Unknown {
    constructor() {
        this.type = _AST_Type.Unknown;
    }
}
exports.Unknown = Unknown;
class _AST_Node {
    constructor({ type = null }) {
        this.type = type;
    }
    stringRepresentation() {
        return "";
    }
}
class BlockStatement extends _AST_Node {
    constructor(body = null) {
        super({
            type: _AST_Type.BlockStatement,
        });
        this.body = [];
        body && (this.body = body);
    }
    stringRepresentation() {
        let body = [];
        for (let node of this.body)
            body.push(node.stringRepresentation());
        return `{${body.join(";")}}`;
    }
}
exports.BlockStatement = BlockStatement;
class CatchClause extends _AST_Node {
    constructor(body, param) {
        super({
            type: _AST_Type.CatchClause,
        });
        this.body = body;
        this.param = param;
    }
    stringRepresentation() {
        let ret = "catch";
        if (this.param != null)
            ret += `(${this.param.stringRepresentation()})`;
        ret += this.body.stringRepresentation();
        return ret;
    }
}
exports.CatchClause = CatchClause;
class TryStatement extends _AST_Node {
    constructor(block, handler) {
        super({
            type: _AST_Type.TryStatement,
        });
        this.block = block;
        this.handler = handler;
    }
    stringRepresentation() {
        return `try ${this.block.stringRepresentation()} ${this.handler.stringRepresentation()}`;
    }
}
exports.TryStatement = TryStatement;
class Program extends _AST_Node {
    constructor(block = null) {
        super({
            type: _AST_Type.Program,
        });
        this.block = new BlockStatement();
        block && (this.block = block);
    }
    stringRepresentation() {
        return this.block.stringRepresentation();
    }
}
exports.Program = Program;
class Literal extends _AST_Node {
    constructor(value) {
        super({
            type: _AST_Type.Literal,
        });
        this.value = value;
    }
    stringRepresentation() {
        if (typeof this.value == "string" &&
            this.value != "null" &&
            this.value != "{}")
            return `"${this.value}"`;
        return `${this.value}`;
    }
}
exports.Literal = Literal;
class Identifier extends _AST_Node {
    constructor(name) {
        super({
            type: _AST_Type.Identifier,
        });
        this.name = name;
    }
    stringRepresentation() {
        return `${this.name}`;
    }
}
exports.Identifier = Identifier;
class _Expression extends _AST_Node {
    constructor(type, left, right) {
        super({
            type,
        });
        this.left = left;
        this.right = right;
    }
}
class MemberExpression extends _AST_Node {
    constructor(object, property) {
        super({
            type: _AST_Type.MemberExpression,
        });
        this.object = object;
        this.property = property;
    }
    stringRepresentation() {
        if (this.object == null)
            this.object = new Identifier("UNKNOWN");
        if (this.property == null)
            this.property = new Identifier("UNKNOWN");
        let ret = `${this.object.stringRepresentation()}`;
        let isIdentLiteral = this.property.type == "Literal" &&
            typeof this.property.value == "string";
        ret += `${isIdentLiteral
            ? `.${this.property.value}`
            : `[${this.property.stringRepresentation()}]`}`;
        return ret;
    }
}
exports.MemberExpression = MemberExpression;
// TODO: Move these two expressions to a single stringRepresentation
class AssignmentExpression extends _Expression {
    constructor(operator, left, right) {
        super(_AST_Type.AssignmentExpression, left, right);
        this.operator = operator;
    }
    stringRepresentation() {
        if (this.right == null)
            this.right = new Identifier("UNKNOWN");
        if (this.left == null)
            this.left = new Identifier("UNKNOWN");
        return `${this.left.stringRepresentation()} ${this.operator} ${this.right.stringRepresentation()}`;
    }
}
exports.AssignmentExpression = AssignmentExpression;
class BinaryExpression extends _Expression {
    constructor(operator, left, right) {
        super(_AST_Type.BinaryExpression, left, right);
        this.operator = operator;
    }
    stringRepresentation() {
        if (this.right == null)
            this.right = new Identifier("UNKNOWN");
        if (this.left == null)
            this.left = new Identifier("UNKNOWN");
        return `${this.left.stringRepresentation()} ${this.operator} ${this.right.stringRepresentation()}`;
    }
}
exports.BinaryExpression = BinaryExpression;
class UnaryExpression extends _AST_Node {
    constructor(operator, prefix, argument) {
        super({ type: _AST_Type.UnaryExpression });
        this.operator = operator;
        this.prefix = prefix;
        this.argument = argument;
    }
    stringRepresentation() {
        return `${this.prefix ? this.operator : ""}${this.argument}${!this.prefix ? this.operator : ""}`;
    }
}
exports.UnaryExpression = UnaryExpression;
class CallExpression extends _AST_Node {
    constructor(callee, _arguments) {
        super({ type: _AST_Type.CallExpression });
        this.callee = callee;
        this.arguments = _arguments;
    }
    stringRepresentation() {
        return `${this.callee.stringRepresentation()}(${this.arguments
            .map((v) => v.stringRepresentation())
            .join(",")})`;
    }
}
exports.CallExpression = CallExpression;
class ArrayExpression extends _AST_Node {
    constructor(elements) {
        super({
            type: _AST_Type.ArrayExpression,
        });
        this.elements = [];
        this.elements = elements;
    }
    stringRepresentation() {
        return `[${this.elements.join(",")}]`;
    }
}
exports.ArrayExpression = ArrayExpression;
class ExpressionStatement extends _AST_Node {
    constructor(expression) {
        super({
            type: _AST_Type.ExpressionStatement,
        });
        this.expression = expression;
    }
    stringRepresentation() {
        return this.expression.stringRepresentation();
    }
}
exports.ExpressionStatement = ExpressionStatement;
class VariableDeclarator extends _AST_Node {
    constructor(init, name) {
        super({
            type: _AST_Type.VariableDeclarator,
        });
        this.id = new Identifier(name);
        this.init = init;
    }
    stringRepresentation() {
        if (this.id == null)
            this.id = new Identifier("UNKNOWN");
        if (this.init == null)
            this.init = new Identifier("UNKNOWN");
        return `${this.id.stringRepresentation()} = ${this.init.stringRepresentation()}`;
    }
}
exports.VariableDeclarator = VariableDeclarator;
// TODO: Disambiguate variable scopes and accessors by reference and mutation counting
var VariableDeclarationKind;
(function (VariableDeclarationKind) {
    VariableDeclarationKind["VAR"] = "var";
    VariableDeclarationKind["LET"] = "let";
    VariableDeclarationKind["CONST"] = "const";
})(VariableDeclarationKind = exports.VariableDeclarationKind || (exports.VariableDeclarationKind = {}));
class VariableDeclaration extends _AST_Node {
    constructor(init, name) {
        super({
            type: _AST_Type.VariableDecl,
        });
        this.kind = VariableDeclarationKind.VAR;
        this.declaration = new VariableDeclarator(init, name);
    }
    stringRepresentation() {
        return `${this.kind} ${this.declaration.stringRepresentation()}`;
    }
}
exports.VariableDeclaration = VariableDeclaration;
class FunctionDeclaration extends _AST_Node {
    constructor(startAddr, paramCount = 0, name) {
        super({
            type: _AST_Type.FunctionDecl,
        });
        this.block = new BlockStatement();
        this.id = new Identifier(name);
        this.paramCount = paramCount;
        this.startAddr = startAddr;
    }
    stringRepresentation() {
        let args = [];
        for (let i = 0; i < this.paramCount; i++)
            args.push(`arg${i}`);
        return `function ${this.id.stringRepresentation()}(${args.join(",")}) ${this.block.stringRepresentation()}`;
    }
}
exports.FunctionDeclaration = FunctionDeclaration;
class IfStatement extends _AST_Node {
    constructor(test, consequent, alternate) {
        super({
            type: _AST_Type.IfStatement,
        });
        this.test = test;
        this.consequent = consequent;
        alternate && (this.alternate = alternate);
    }
    stringRepresentation() {
        let ret = "";
        if (this.test == null)
            this.test = new Identifier("UNKNOWN");
        ret += `if(${this.test.stringRepresentation()})${this.consequent.stringRepresentation()}`;
        if (this.alternate != null)
            ret += `else${this.alternate.stringRepresentation()}`;
        return ret;
    }
}
exports.IfStatement = IfStatement;
class ReturnStatement extends _AST_Node {
    constructor(argument) {
        super({
            type: _AST_Type.ReturnStatement,
        });
        this.argument = argument;
    }
    stringRepresentation() {
        return ("return" +
            (this.argument != null
                ? " " + this.argument.stringRepresentation()
                : "") +
            ";");
    }
}
exports.ReturnStatement = ReturnStatement;
class ThrowStatement extends _AST_Node {
    constructor(argument) {
        super({
            type: _AST_Type.ThrowStatement,
        });
        this.argument = argument;
    }
    stringRepresentation() {
        return `throw ${this.argument.stringRepresentation()};`;
    }
}
exports.ThrowStatement = ThrowStatement;
