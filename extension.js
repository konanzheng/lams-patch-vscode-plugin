// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "lams-patch" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	vscode.commands.getCommands().then(commands => {
		commands.forEach(element => {
			if (element.indexOf('log') >-1 || element.indexOf('git') > -1) {
				console.log(element);
			}
		});
	})
	let disposable = vscode.commands.registerCommand('lams-patch.makePatch', function () {
		// The code you place here will be executed every time your command is executed
		let wsf = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
		vscode.window.showInputBox( {title:'请输入起始commitID' }).then(function (value) {
			console.log(value)
			if (!value) {
				vscode.window.showInformationMessage('未输入正确的commitID');
				return ;
			}
			vscode.window.showOpenDialog({title:'请选择补丁包存储路径',canSelectFiles:false,canSelectFolders:true,canSelectMany:false,openLabel:'生成补丁'}).then(function (path) {
				if (!path){
					vscode.window.showInformationMessage('未选择补丁包存储路径');
					return ;
				}
				// console.log("选择用于生成补丁的路径:"+path)
				// vscode.window.showInformationMessage('用于生成补丁的路径:'+path);
				let commandStr = "lams-patch  '"+wsf.uri.fsPath+"' '"+path[0].fsPath+"' "+value
				// console.log(" 调用本地名称生成补丁包: "+commandStr);
				let terminal  = vscode.window.createTerminal("make Patch");
				terminal.show(true);
				terminal.sendText(commandStr);
				vscode.window.showInformationMessage('正在生成补丁！！');
			})
			// vscode.window.showInformationMessage('起始commitID:'+value);
		})
		// Display a message box to the user
	});
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
function deactivate() {
	vscode.window.showInformationMessage('bye bye  from lams-patch!');
}

module.exports = {
	activate,
	deactivate
}
