"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const cp = require("child_process");
const elegantSpinner = require("elegant-spinner");
let myStatusBarItem;
exports.nextElementIsValid = (code, length) => {
    for (let index = 0; index < 1000; index++) {
        const text = code.charAt(length).trim();
        if (text) {
            if (/[;),\]]/.test(text)) {
                return true;
            }
            else {
                return false;
            }
        }
        length++;
    }
    return false;
};
exports.getSelectedText = (editor) => {
    let offset_l = editor.document.offsetAt(editor.selection.start);
    let offset_r = editor.document.offsetAt(editor.selection.end) - 1;
    let text = editor.document.getText();
    const re = /[^a-zA-Z]/;
    for (let index = (text.length - offset_l); index > 0; index--) {
        let textOff = text.charAt(offset_l);
        if (textOff !== '.' && re.test(textOff)) {
            offset_l++;
            if (/[^A-Z]/.test(text.charAt(offset_l))) {
                return new vscode.Selection(editor.document.positionAt(0), editor.document.positionAt(0));
            }
            let lineText = editor.document.lineAt(editor.document.positionAt(offset_l).line).text;
            if (lineText.indexOf('class') != -1 || lineText.indexOf('extends') != -1 || lineText.indexOf('with') != -1 || lineText.indexOf('implements') != -1 || lineText.indexOf('=') != -1) {
                return new vscode.Selection(editor.document.positionAt(0), editor.document.positionAt(0));
            }
            break;
        }
        else {
            offset_l--;
        }
    }
    let l = 0;
    let r = 0;
    for (let index = (text.length - offset_r); index < text.length; index++) {
        if (text.charAt(offset_r) === '(') {
            l++;
        }
        if (text.charAt(offset_r) === ')') {
            r++;
        }
        if (r > l || index == text.length) {
            offset_r = 0;
            offset_l = 0;
            break;
        }
        if (l > 0 && l == r) {
            offset_r++;
            if (!exports.nextElementIsValid(text, offset_r)) {
                offset_r = 0;
                offset_l = 0;
            }
            break;
        }
        offset_r++;
    }
    return new vscode.Selection(editor.document.positionAt(offset_l), editor.document.positionAt(offset_r));
};
class CodeActionProvider {
    provideCodeActions() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return [];
        }
        const selectedText = editor.document.getText(exports.getSelectedText(editor));
        const codeActions = [];
        if (selectedText !== '') {
            codeActions.push({
                command: "flutterMobx.extension.wrapObserver",
                title: "Wrap with Observer"
            });
        }
        return codeActions;
    }
}
exports.CodeActionProvider = CodeActionProvider;
function activate(context) {
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ pattern: "**/*.{dart,dartx}", scheme: "file" }, new CodeActionProvider()));
    let disposableWrapObserver = vscode.commands.registerCommand('flutterMobx.extension.wrapObserver', () => __awaiter(this, void 0, void 0, function* () {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selectedText = exports.getSelectedText(editor);
        const text = editor.document.getText(selectedText);
        const newTextWidget = `Observer(builder: (_) {return ${text};})`;
        yield editor.edit(edit => {
            edit.replace(selectedText, newTextWidget);
        });
        yield vscode.commands.executeCommand("editor.action.formatDocument");
    }));
    context.subscriptions.push(disposableWrapObserver);
    const myCommandId = 'flutterMobx.extension.BuildRunnerWatch';
    // create a new status bar item that we can now manage
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200);
    myStatusBarItem.command = myCommandId;
    context.subscriptions.push(myStatusBarItem);
    var child;
    let disposableBuildRunnerWatch = vscode.commands.registerCommand(myCommandId, () => __awaiter(this, void 0, void 0, function* () {
        if (child == null) {
            child = cp.spawn('flutter pub run build_runner watch --delete-conflicting-outputs', [], {
                windowsVerbatimArguments: true,
                cwd: vscode.workspace.rootPath,
                shell: true
            });
            child.addListener('close', (err) => {
                console.log(`close: ${err}`);
                updateButton(TypeButton.watch);
                if (err == 0) {
                    vscode.window.showInformationMessage('build_runner finish');
                }
                else {
                    throw 'build_runner error';
                }
            });
            child.addListener('error', (err) => {
                console.log(`error: ${err}`);
                updateButton(TypeButton.watch);
            });
            child.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
                if (data.indexOf('Succeeded after') != -1) {
                    updateButton(TypeButton.unwatch);
                }
                else {
                    updateButton(TypeButton.loading);
                }
            });
            child.stderr.on('data', (data) => {
                console.log(`stderr: ${data}`);
            });
        }
        else {
            console.log('destroy');
            child.removeAllListeners();
            child.kill();
            child = null;
            updateButton(TypeButton.watch);
        }
    }));
    updateButton(TypeButton.watch);
    myStatusBarItem.show();
    context.subscriptions.push(disposableBuildRunnerWatch);
}
exports.activate = activate;
function updateButton(type) {
    if (prevNowPlaying && type != TypeButton.loading) {
        clearInterval(prevNowPlaying);
        prevNowPlaying = null;
    }
    if (type == TypeButton.watch) {
        myStatusBarItem.text = `$(file-binary) build_runner watch`;
    }
    else if (type == TypeButton.unwatch) {
        myStatusBarItem.text = `$(file-binary) build_runner unwatch`;
    }
    else if (type == TypeButton.loading) {
        if (!prevNowPlaying) {
            myStatusBarItem.text = `${frame()} build_runner unwatch`;
            prevNowPlaying = setInterval(() => {
                myStatusBarItem.text = `${frame()} build_runner unwatch`;
            }, 500);
        }
    }
}
var prevNowPlaying = null;
const frame = elegantSpinner();
var TypeButton;
(function (TypeButton) {
    TypeButton[TypeButton["loading"] = 0] = "loading";
    TypeButton[TypeButton["watch"] = 1] = "watch";
    TypeButton[TypeButton["unwatch"] = 2] = "unwatch";
})(TypeButton || (TypeButton = {}));
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map