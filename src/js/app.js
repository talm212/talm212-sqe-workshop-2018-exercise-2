import $ from 'jquery';
import {parseCode, subCode} from './code-analyzer';
import * as escodegen from 'escodegen';

$(document).ready(function () {

    $('#codeSubmissionButton').click(() => {
        let code = changeString($('#codeInput').val());
        let args = $('#argsInput').val();

        let firstSub = subCode(parseCode(code,true), '');
        let secondSub = subCode(parseCode(code,true) ,args);

        evalColors(firstSub, secondSub);
    });
});

function changeString(code){
    return code.replace(/[\r\n]+/g, '\n')
        .replace(/[\r\n]+/g, '\r\n')
        .replace('\r\n{','{')
        .replace('}\r\n','}');
}

function changeJson(json){
    return json.replace(/\[[\r\n]+/g,'[')
        .replace(/,[\r\n]+/g,',')
        .replace('\n    ];','];')
        .replace('\n];','];');
}

function evalColors(firstSub, secondSub) {
    let result = [];
    let json = changeJson(escodegen.generate(firstSub['json']));

    let lines = json.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (!firstSub['ignoreList'].includes(i)) {
            let rowColor = 'black';
            if (secondSub['reds'].includes(i)) rowColor = 'red';
            if (secondSub['greens'].includes(i)) rowColor = 'green';
            result.push({'line':lines[i], 'color':rowColor});
        }
    }
    $('#result').empty();
    for(let i= 0; i < result.length; i++)
        $('#result').append('<span style="color:' + result[i].color + ';">' + result[i].line + '</span><br>');
}