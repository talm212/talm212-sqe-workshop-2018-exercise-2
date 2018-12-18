import * as esprima from 'esprima';
import * as escodegem from 'escodegen';

const parseCode = (codeToParse, loc) => {
    let parsedCode = esprima.parseScript(codeToParse, {loc: loc});
    return parsedCode;
};

let listOperators = ['+','-','*','/'];
let greens = [];
let reds = [];
let ignoreList = [];
let params = [];
let funcBool = false;
let ifBool = false;

function copy(obj) {
    let newobj = {};
    for(let key in obj){
        newobj[key] = obj[key];
    }
    return newobj;
}

function getNewEnv(env, args) {
    if(params.length === 0)
        return env;
    let newEnv = copy(env);
    if(args.length > 0)
        for (let i = 0; i < args.length; i++) {
            if (args[i].type === 'ArrayExpression') {
                for (let itemIndex = 0; itemIndex < args[i].elements.length; itemIndex++) {
                    newEnv[params[i] + '[' + itemIndex + ']'] = args[i].elements[itemIndex];
                }
            } else {
                newEnv[params[i]] = args[i];
            }
        }
    else
        for (let i = 0; i < params.length; i++) {
            env[params[i]] = parseCode(params[i]).body[0].expression;
        }
    return newEnv;
}

function wrapperUpdateLineColors(jsonToParse, env, args) {

    let clonejsonToParse = parseCode(escodegem.generate(jsonToParse.test), true);
    let evaluatedTest = parseJson(clonejsonToParse.body[0].expression,copy(env), args);
    if(evaluatedTest.type === 'BinaryExpression'){
        if (evaluatedTest.left.type === 'Literal' && evaluatedTest.right.type === 'Literal') {
            let value = eval(evaluatedTest.left.raw + evaluatedTest.operator + evaluatedTest.right.raw);
            evaluatedTest = {'loc': evaluatedTest.loc, 'value': value, 'type': 'Literal', 'raw': '' + value };
        }
    }
    if (evaluatedTest.type === 'Literal') {
        if (evaluatedTest.value) greens.push(jsonToParse.test.loc.start.line-1);
        else reds.push(jsonToParse.test.loc.start.line-1);
        if (jsonToParse.alternate != null) {
            if (evaluatedTest.value) reds.push(jsonToParse.alternate.loc.start.line-1);
            else greens.push(jsonToParse.alternate.loc.start.line-1);
        }
    }
}

function createEnvKey(jsonToParse, leftName, env, args) {
    let envKey = leftName;
    if (jsonToParse.left.type === 'MemberExpression'){
        let itemIndex = '';
        let itemIndexjsonToParse = parseJson(jsonToParse.left.property, env, args);
        if(itemIndexjsonToParse.type === 'Literal'){
            itemIndex = itemIndexjsonToParse.raw;
        }
        envKey = jsonToParse.left.object.name+'['+itemIndex+']';
    }
    return envKey;
}

function parseJson(jsonToParse, env, args) {
    return funcs[jsonToParse.type](jsonToParse, env, args);
}


const subCode = (jsonToParse, args) => {
    greens = [];
    reds = [];
    ignoreList = [];
    params = [];
    funcBool = false;
    ifBool = !(args==='');

    let newArgs = [];
    if(!(args === '')) {
        let parsedArgs = esprima.parseScript(args);
        parsedArgs = parsedArgs.body[0].expression;
        if (parsedArgs.expressions !== undefined) {
            newArgs = parsedArgs.expressions;
        }
    }
    let updatedjsonToParse = parseJson(jsonToParse, {}, newArgs);

    return { 'greens': greens, 'json': updatedjsonToParse,'reds':reds, 'ignoreList': ignoreList};
};

const literal = (jsonToParse) => {
    return jsonToParse;
};

const identifier = (jsonToParse, env, args) => {
    if (jsonToParse.name in env) {
        if (!params.includes(jsonToParse.name))
            jsonToParse = env[jsonToParse.name];
        else if (params.length === args.length)
            jsonToParse = env[jsonToParse.name];
    }

    return jsonToParse;
};

const variableDeclarator = (jsonToParse, env, args) => {

    if(jsonToParse.init){
        jsonToParse.init = parseJson(jsonToParse.init, env, args);
        if(jsonToParse.init.type === 'ArrayExpression'){
            let i = 0;
            while( i < jsonToParse.init.elements.length){
                env[jsonToParse.id.name+'['+i+']'] = jsonToParse.init.elements[i];
                i++;
            }
            return jsonToParse;
        }
    }
    env[jsonToParse.id.name] = jsonToParse.init;
    return jsonToParse;
};

const returnStmt = (jsonToParse, env, args) => {
    jsonToParse.argument = parseJson(jsonToParse.argument, env, args);
    return jsonToParse;
};

const assignExp = (jsonToParse, env, args) => {
    let leftName = '';
    leftName = (jsonToParse.left.type === 'MemberExpression')?jsonToParse.left.object.name:jsonToParse.left.name;

    if (funcBool)
        if(!(params.includes(leftName)))
            ignoreList.push(jsonToParse.loc.start.line - 1);
    jsonToParse.right = parseJson(jsonToParse.right, env, args);
    let envKey = createEnvKey(jsonToParse, leftName, env, args);
    env[envKey] = jsonToParse.right;

    return jsonToParse;
};

const variableDeclaration = (jsonToParse, env, args) => {
    let i = 0;
    while ( i < jsonToParse.declarations.length) {
        if(funcBool)
            ignoreList.push(jsonToParse.declarations[i].loc.start.line - 1);
        jsonToParse.declarations[i] = parseJson(jsonToParse.declarations[i], env, args);
        i++;
    }
    return jsonToParse;
};

const program = (jsonToParse, env, args) => {
    let i = 0
    while(i < jsonToParse.body.length) {
        jsonToParse.body[i] = parseJson(jsonToParse.body[i], env, args);
        i++;
    }
    return jsonToParse;
};

const whileStmt = (jsonToParse, env, args) => {
    jsonToParse.test = parseJson(jsonToParse.test, env, args);
    jsonToParse.body = parseJson(jsonToParse.body, copy(env), args);
    return jsonToParse;
};

const ifStmt = (jsonToParse, env, args) => {

    jsonToParse.test = parseJson(jsonToParse.test, env, args);
    if(ifBool){
        wrapperUpdateLineColors(jsonToParse, env, args);
    }
    jsonToParse.consequent = parseJson(jsonToParse.consequent, copy(env), args);
    if(jsonToParse.alternate) {
        jsonToParse.alternate = parseJson(jsonToParse.alternate, copy(env), args);
    }
    return jsonToParse;
};

const blockStmt = (jsonToParse, env, args) => {
    let i = 0;
    while( i < jsonToParse.body.length) {
        jsonToParse.body[i] = parseJson(jsonToParse.body[i], env, args);
        i++;
    }
    return jsonToParse;
};

const update = (jsonToParse, env, args) => {
    jsonToParse.argument = parseJson(jsonToParse.argument, env, args);
    return jsonToParse;
};

const expression = (jsonToParse, env, args) => {
    jsonToParse.expression = parseJson(jsonToParse.expression, env, args);
    return jsonToParse;
};

const member = (jsonToParse, env, args) => {
    jsonToParse.property = parseJson(jsonToParse.property, env, args);
    let key = '';
    if(jsonToParse.property.type === 'Literal'){
        key = jsonToParse.object.name+'['+jsonToParse.property.raw+']';
    }
    if(key in env){
        if(params.includes(jsonToParse.object.name)) {
            if (params.length === args.length) {
                return env[key];
            }
        }
        else{
            return env[key];
        }

    }
    return jsonToParse;
};

const binary = (jsonToParse, env, args) => {
    jsonToParse.right = parseJson(jsonToParse.right, env, args);
    jsonToParse.left = parseJson(jsonToParse.left, env, args);
    if(listOperators.includes(jsonToParse.operator)) {
        if (jsonToParse.left.type === 'Literal')
            if(jsonToParse.right.type === 'Literal') {
                let value = eval(jsonToParse.left.raw + jsonToParse.operator + jsonToParse.right.raw);
                return {'loc': jsonToParse.loc,'value': value ,'type': 'Literal', 'raw': '' + value };
            }
    }
    return jsonToParse;
};

const funcDecl = (jsonToParse, env, args) => {

    for (let i = 0; i < jsonToParse.params.length; i++) {
        params.push(jsonToParse.params[i].name);
    }

    let bodyEnv = getNewEnv(env, args);
    funcBool = true;
    jsonToParse.body = parseJson(jsonToParse.body, bodyEnv, args);
    funcBool = false;
    return jsonToParse;
};

let funcs = {
    'Literal': literal,
    'Identifier': identifier,
    'BinaryExpression': binary,
    'VariableDeclarator': variableDeclarator,
    'ReturnStatement': returnStmt,
    'MemberExpression': member,
    'ExpressionStatement': expression,
    'AssignmentExpression': assignExp,
    'UpdateExpression': update,
    'FunctionDeclaration': funcDecl,
    'VariableDeclaration': variableDeclaration,
    'BlockStatement': blockStmt,
    'IfStatement': ifStmt,
    'WhileStatement': whileStmt,
    'Program': program,
};

export {parseCode, subCode};
