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
	// vscode.commands.getCommands().then(commands => {
	// 	commands.forEach(element => {
	// 		if (element.indexOf('git.') >-1) {
	// 			console.log(element);
	// 		}
	// 	});

	// })
	
	let disposable = vscode.commands.registerCommand('lams-patch.makePatch', function () {
		// The code you place here will be executed every time your command is executed
		let wsf = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
		
		console.log(wsf.uri.fsPath)
		vscode.extensions.getExtension('vscode.git').activate().then(function (extension) {
			let git = extension.getAPI(1);
			if(git){
				if (git.repositorys && git.repositorys.length >0 ){
					getLogs(wsf,git.repositorys[0]);
				}else {
					git.openRepository(wsf.uri).then(function (repository) {
						if (repository) {
							getLogs(wsf,repository);
						}else{
							showInputBox(wsf);
						}
					})
				}
			}else{
				showInputBox(wsf);
			}
		})
		// Display a message box to the user
	});
	context.subscriptions.push(disposable);
}
function getLogs(wsf,repository){
	repository.log('-10').then((commit_logs) => {
		let selectIds =[];
		let logs=[]
		commit_logs.forEach(c => {
			logs.push(c.hash.substring(0,6) + ':' +c.message.split(/[\n]/)[0])
		})
		showCommitSelection('第一步：选择最新commitID',logs,function (commitId) {
			console.log('选择commit:' + commitId);
			if(commitId) {
				selectIds[0] = commitId.substring(0,6);
				showCommitSelection('第二部:选择上次部署commitID',logs,function(oldId){
					console.log('选择commit:' +oldId)
					if(oldId) {
						selectIds[1] = oldId.substring(0,6);
						doPatch(wsf,selectIds.join(' '));
					}else {
						vscode.window.showInformationMessage('未选择上次部署commitID');
						return ;
					}
				})
			} else {
				vscode.window.showInformationMessage('未选择最新commitID');
				return ;
			}
		})
	});
}
function showCommitSelection(placeHolder,commitIds,callback) {
	vscode.window.showQuickPick(commitIds, {
		placeHolder: placeHolder,
	  }).then(callback);
}
function showInputBox (wsf) {
	vscode.window.showInputBox( {title:'请输入起始commitID' }).then(function (value) {
		console.log(value)
		if (!value) {
			vscode.window.showInformationMessage('未输入正确的commitID');
			return ;
		}
		doPatch(wsf, value);
		// vscode.window.showInformationMessage('起始commitID:'+value);
	})
}
function doPatch (wsf,commitIds) {
	vscode.window.showOpenDialog({title:'请选择补丁包存储路径',canSelectFiles:false,canSelectFolders:true,canSelectMany:false,openLabel:'生成补丁'}).then(function (path) {
		if (!path){
			vscode.window.showInformationMessage('未选择补丁包存储路径');
			return ;
		}
		let commandStr = "lams-patch  '"+wsf.uri.fsPath+"' '"+path[0].fsPath+"' "+commitIds
		console.log(" 调用本地名称生成补丁包: "+commandStr);
		vscode.window.showInformationMessage('正在生成补丁！！');
		let terminal  = vscode.window.createTerminal("make Patch");
		terminal.show(true);
		terminal.sendText(commandStr);
	})
}

// this method is called when your extension is deactivated
function deactivate() {
	vscode.window.showInformationMessage('bye bye  from lams-patch!');
}

module.exports = {
	activate,
	deactivate
}
