// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import cp = require('child_process');
import elegantSpinner = require('elegant-spinner');

let myStatusBarItem: vscode.StatusBarItem;
export const nextElementIsValid = (code: string, length: number): Boolean => {
  for (let index = 0; index < 1000; index++) {

    const text = code.charAt(length).trim();
    if (text) {
      if (/[;),\]]/.test(text)) {
        return true;
      } else {
        return false;
      }
    }
    length++;

  }
  return false;

};

export const getSelectedText = (editor: vscode.TextEditor): vscode.Selection => {
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
      let lineText: string = editor.document.lineAt(editor.document.positionAt(offset_l).line).text;
      if (lineText.indexOf('class') != -1 || lineText.indexOf('extends') != -1 || lineText.indexOf('with') != -1 || lineText.indexOf('implements') != -1 || lineText.indexOf('=') != -1) {
        return new vscode.Selection(editor.document.positionAt(0), editor.document.positionAt(0));
      }

      break;
    } else {
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
      r++
    }

    if (r > l || index == text.length) {
      offset_r = 0;
      offset_l = 0;
      break;
    }

    if (l > 0 && l == r) {
      offset_r++;
      if (!nextElementIsValid(text, offset_r)) {
        offset_r = 0;
        offset_l = 0;
      }
      break;
    }
    offset_r++;

  }

  return new vscode.Selection(editor.document.positionAt(offset_l), editor.document.positionAt(offset_r));
};


export class CodeActionProvider implements vscode.CodeActionProvider {
  public provideCodeActions(): vscode.Command[] {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return [];
    }

    const selectedText = editor.document.getText(getSelectedText(editor));
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

const isActivityBuildRunner: boolean = false;

export function activate(context: vscode.ExtensionContext) {


  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { pattern: "**/*.{dart,dartx}", scheme: "file" },
      new CodeActionProvider()
    )
  );


  let disposableWrapObserver = vscode.commands.registerCommand('flutterMobx.extension.wrapObserver', async () => {
    let editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const selectedText = getSelectedText(editor);
    const text = editor.document.getText(selectedText);
    const newTextWidget = `Observer(builder: (_) {return ${text};})`;

    await editor.edit(edit => {
      edit.replace(selectedText, newTextWidget);
    });
    await vscode.commands.executeCommand(
      "editor.action.formatDocument"
    );
  });

  context.subscriptions.push(disposableWrapObserver);

  const myCommandId = 'flutterMobx.extension.BuildRunnerWatch';

  // create a new status bar item that we can now manage
  myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200);
  myStatusBarItem.command = myCommandId;
  context.subscriptions.push(myStatusBarItem);
  var child: any;


  let disposableBuildRunnerWatch = vscode.commands.registerCommand(myCommandId, async () => {
    if (child == null) {
      try {
        updateButton(TypeButton.loading);
        var cleanChild = cp.exec('flutter pub run build_runner clean', { cwd: vscode.workspace.rootPath });
        await promiseFromChildProcess(cleanChild);

      } catch (e) {
        updateButton(TypeButton.watch);
      }
      child = cp.spawn('flutter pub run build_runner watch', [], {
        windowsVerbatimArguments: true,
        cwd: vscode.workspace.rootPath,
        shell: true
      });

      child.addListener('close', (err: any) => {
        console.log(`close: ${err}`);
        updateButton(TypeButton.watch);
        if(err == 0){
          vscode.window.showInformationMessage('build_runner finish');
        } else {
          throw 'build_runner error';
        }
      });
      child.addListener('error', (err: any) => {
        console.log(`error: ${err}`);
        updateButton(TypeButton.watch);
      });


      child.stdout.on('data', (data: any) => {
        console.log(`stdout: ${data}`);
        if ((data as string).indexOf('Succeeded after') != -1) {
          updateButton(TypeButton.unwatch);
        } else {
          updateButton(TypeButton.loading);
        }
      });
      child.stderr.on('data', (data: any) => {
        console.log(`stderr: ${data}`);
      });

    } else {
      console.log('destroy');
      (child as cp.ChildProcessWithoutNullStreams).removeAllListeners();
      (child as cp.ChildProcessWithoutNullStreams).kill();
      child = null;
      updateButton(TypeButton.watch);
    }

  });

  updateButton(TypeButton.watch);
  myStatusBarItem.show();
  context.subscriptions.push(disposableBuildRunnerWatch);
}

function promiseFromChildProcess(child: any) {
  return new Promise(function (resolve, reject) {
    child.addListener("error", reject);
    child.addListener("exit", resolve);
  });
}


function updateButton(type: TypeButton) {
  if (prevNowPlaying && type != TypeButton.loading) {
    clearInterval(prevNowPlaying);
    prevNowPlaying = null;
  }

  if (type == TypeButton.watch) {
    myStatusBarItem.text = `$(file-binary) build_runner watch`;
  } else if (type == TypeButton.unwatch) {
    myStatusBarItem.text = `$(file-binary) build_runner unwatch`;
  } else if (type == TypeButton.loading) {
    if (!prevNowPlaying) {
      myStatusBarItem.text = `${frame()} build_runner unwatch`;
      prevNowPlaying = setInterval(() => {
        myStatusBarItem.text = `${frame()} build_runner unwatch`;
      }, 500);
    }
  }
}
var prevNowPlaying: any = null;
const frame = elegantSpinner();
enum TypeButton {
  loading, watch, unwatch
}




export function deactivate() { }