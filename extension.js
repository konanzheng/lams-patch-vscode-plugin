// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

const vscode = require('vscode');
// const URI = require('URI');


const WEBAPP = "/src/main/webapp";
const JAVA = "/src/main/java";
const RESOURCES = "/src/main/resources";
const WEBINF = "/WEB-INF/classes";
const TARGET = "/target/classes";

// 路径转换
function transform_path(src ) {
    let dest = src;
    if (src.indexOf(WEBAPP) >-1){
        dest = src.replace(WEBAPP, "");
    } else if (src.indexOf(RESOURCES)>-1) {
        dest = src.replace(RESOURCES, WEBINF);
    } else if ( src.indexOf(JAVA)>-1) {
        dest = src.replace(JAVA, WEBINF).replace(".java", ".class");
    }
    // println!("路径转换前:{},转换后:{}",src,dest);
    return dest;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	// console.log('Congratulations, your extension "lams-patch" is now active!');
	let disposable = vscode.commands.registerCommand('lams-patch.makePatch', function () {
		let wsf = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
		// console.log(wsf.uri.fsPath)
		vscode.extensions.getExtension('vscode.git').activate().then(function (extension) {
			let git = extension.getAPI(1);
			if(git){
				if (git.repositorys && git.repositorys.length >0 ){
					getLogs(git.repositorys[0]);
				}else {
					git.openRepository(wsf.uri).then(function (repository) {
						if (repository) {
							getLogs(repository);
						} else {
							vscode.window.showErrorMessage('未找到git仓库');
						}
					})
				}
			}
		})
	});
	context.subscriptions.push(disposable);
}
function getLogs(repository){
	repository.log('-20').then((commit_logs) => {
		let selectIds =[];
		let logs=[]
		commit_logs.forEach(c => {
			console.log(c)
			let description = "提交人和时间: "+c.authorName+"("+c.authorEmail+")" +  "  " + dateFormat(c.commitDate)
			let label = 'hash: '+ c.hash
			let hash = c.hash
			let detail = "message: "+c.message
			logs.push({ label,description,hash,detail})
		})
		showCommitSelection('可以通过hash或者message过滤',logs,function (option) {
			if(option && option.length>0) {
				// 选中多个commitID 取范围最大的两个作为边界，选中一个默认边界到最新的
				if(option.length > 1){
					selectIds[0] = option[0].hash;
					selectIds[1] = option[option.length-1].hash;
				}else {
					selectIds[0] = logs[0].hash;
					selectIds[1] = option[0].hash;
					if(selectIds[0] == selectIds[1]){
						vscode.window.showErrorMessage('仅选择最新commitID无法比较生成增量包，请选择多个commitID或非最新的单个commitID');
						return;
					}
				}
				doPatch(repository,selectIds);
			}else {
				vscode.window.showErrorMessage('未选择需要部署commitID');
				return ;
			}
		})
	});
}
function dateFormat (dateStr){
	let date = new Date(dateStr);
	var  year = date.getFullYear(); 
	var  month =(date.getMonth() + 1).toString(); 
	var  day = (date.getDate()).toString();  
	if  (month.length == 1) { 
		month =  "0"  + month; 
	} 
	if  (day.length == 1) { 
		day =  "0"  + day; 
	}
	var hour = date.getHours().toString();
	if  (hour.length == 1) { 
		hour =  "0"  + hour; 
	}
	var  minute = date.getMinutes().toString();
	if  (minute.length == 1) { 
		minute =  "0"  + minute; 
	}
	var  second = date.getSeconds().toString();
	if  (second.length == 1) { 
		second =  "0"  + second; 
	}
	var  dateTime = year +  "-"  + month +  "-"  + day +  " " + hour + ":" + minute+":"+second;
	return  dateTime; 
 }
function showCommitSelection(placeHolder,commitIds,callback) {
	vscode.window.showQuickPick(commitIds, {
		placeHolder: placeHolder,
		canPickMany:true,
		ignoreFocusOut:true,
		matchOnDescription:true,
		matchOnDetail:true,
		title:"选择用于生成补丁的，commitID范围"
	  }).then(callback);
}
function doPatch (repostory,selectIds) {
	vscode.window.showOpenDialog({title:'请选择补丁包存储路径',canSelectFiles:false,canSelectFolders:true,canSelectMany:false,openLabel:'生成补丁'}).then(function (path) {
		if (!path){
			vscode.window.showErrorMessage('未选择补丁包存储路径');
			return ;
		}
		const opc = vscode.window.createOutputChannel('补丁生成工具lams-patch'); 
		opc.clear(); // 清空
		opc.appendLine('开始生成从' +selectIds[1]+' 到 '+ selectIds[0] +'的补丁包...');
		opc.show(); // 打开控制台并切换到OutputChannel tab
		repostory.diffBetween(selectIds[1],selectIds[0]).then((changes) => {
			let root = repostory.rootUri
			let pomFlag = false;
			if(changes) {
				changes.forEach(c=>{
					console.log(c)
					opc.appendLine(c.uri.path + '  ' + c.status);
					if (c.uri.fsPath.indexOf('pom.xml') >0) {
						pomFlag = true;
					}
					if (c.uri.fsPath.indexOf('src') !==0){
						// MODIFIED  5 修改 ; DELETED  6 删除; UNTRACKED  7 新增; IGNORED  8 忽略; INTENT_TO_ADD  9 新增
						delFile(opc,root,c.uri,path[0])
					}
				})
				changes.forEach(c=>{
					
					if (c.uri.fsPath.indexOf('src') !==0){
						// MODIFIED  5 修改 ; DELETED  6 删除; UNTRACKED  7 新增; IGNORED  8 忽略; INTENT_TO_ADD  9 新增
						if (c.status!=6) {
							copyFile(opc,root,c.uri,path[0])
						}
					}
				})
				versionFiles(opc,root,path[0])
				vscode.window.showInformationMessage('补丁已生成！！');
				if (pomFlag) {
					opc.appendLine('检测到pom.xml变动，请尽量使用完整包，或者手动处理jar包依赖。')
					vscode.window.showWarningMessage('检测到pom.xml变动，请尽量使用完整包，或者手动处理jar包依赖。');
					
				}
			}
		})
	})
}

function versionFiles(opc,root,dir){
	try {
		let files = ['/src/main/webapp/git.properties','/src/main/resources/vue/VERSION','/src/main/resources/vue/COMMITHASH']
		files.forEach(f=>{
			let source = vscode.Uri.file(root.path + f)
			let target = vscode.Uri.file(dir.path + transform_path(f))
			vscode.workspace.fs.copy(source,target,{overwrite:true}).then(()=>{
				console.log('拷贝成功:'+source.path+'到'+target.path)
				opc.appendLine('拷贝成功:'+source.path+'到'+target.path);
			}).catch(error=>{
				console.log('拷贝失败:'+source.path+'到'+target.path+'\n'+error);
				opc.appendLine('拷贝失败:'+source.path+'到'+target.path+'\n'+error);
			})
		})
	} catch (error) {
		console.log('覆盖版本文件出错：'+error)
	}
}
async function delFile(opc,root,uri,dir){
	// console.log(root,uri,dir)
	let path = dir.path + transform_path(uri.path.replace(root.path,''))
	let split = path.split(".")
	let del  = vscode.Uri.file(path)
	try {
		await vscode.workspace.fs.delete(del);
		console.log('已删除:'+path)
		opc.appendLine('已删除:'+path);
		// // 判断.class 结尾的要删除内部类文件
		if(split[split.length-1]==='class'){
			let parent = vscode.Uri.joinPath(del,'..')
			opc.appendLine('删除class内部类文件:' + parent.path)
			try{
				let r = await vscode.workspace.fs.readDirectory(parent);
				if(r && r.length>0){
					for(var i=0;i<r.length;i++){
						let split = r[i][0].split('\$')
						if(r[i][1] == 1 && del.path.indexOf(split[0]+'.class')>0){
							let del_class = vscode.Uri.joinPath(parent,'/'+r[i][0])
							if(del_class.path !== del.path){
								try {
									await vscode.workspace.fs.delete(del_class);
									opc.appendLine('已删除:'+del_class.path);
								} catch (error) {
									opc.appendLine("文件不存在："+del_class.path);
								}
							}
						}
					}
				}
			}catch(error){
				console.log('目录不存在:'+parent.path)
				opc.appendLine('目录不存在:'+parent.path);
			}
		}
	} catch (error) {
		console.log("删除文件不存在："+del.path)
		opc.appendLine('删除文件不存在：'+del.path);
	}
}
async function copyFile(opc,root,uri,dir){
	let split = uri.path.split(".")
	let is_class = split[split.length-1]==='java'
	let path =transform_path(uri.path.replace(root.path,''))
	let target  = vscode.Uri.file( dir.path + path)
	let source  = uri
	if(is_class){
		source = vscode.Uri.file(root.path + path.replace(WEBINF, TARGET))
	}
	let success = false;
	try {
		await vscode.workspace.fs.copy(source,target,{overwrite:true});
		console.log('拷贝成功:'+source.path+'到'+target.path)
		opc.appendLine('拷贝成功:'+source.path+'到'+target.path);
		success = true;
	} catch (error) {
		console.log('拷贝失败:'+source.path+'到'+target.path+'\n'+error);
		opc.appendLine('拷贝失败:'+source.path+'到'+target.path+'\n'+error)
	}
	if(!success){
		// 拷贝失败时进行二次尝试
		try {
			await vscode.workspace.fs.copy(source,target,{overwrite:true});
			console.log('第二次拷贝成功:'+source.path+'到'+target.path)
			opc.appendLine('第二次拷贝成功:'+source.path+'到'+target.path);
			success = true;
		} catch (error) {
			console.log('第二次拷贝失败:'+source.path+'到'+target.path+'\n'+error);
			opc.appendLine('第二次拷贝失败:'+source.path+'到'+target.path+'\n'+error)
		}
	}
	// 判断.class 结尾的要拷贝内部类文件
	if(is_class){
		let parent = vscode.Uri.joinPath(source,'..')
		try{
			let r = await vscode.workspace.fs.readDirectory(parent);
			if(r && r.length>0){
				for(var i=0;i<r.length;i++){
					let split = r[i][0].split('\$')
					if(r[i][1] == 1 && source.path.indexOf(split[0]+'.class')>0){
						let from = vscode.Uri.joinPath(parent,'/'+r[i][0])
						let to = vscode.Uri.joinPath(target,'../'+r[i][0])
						try {
							await vscode.workspace.fs.copy(from,to,{overwrite:true});
							console.log('拷贝成功:'+from.path+'到'+to.path)
							opc.appendLine('拷贝成功:'+from.path+'到'+to.path);
						} catch (error) {
							console.log('拷贝失败:'+from.path+'到'+to.path+'\n'+error);
							opc.appendLine('拷贝失败:'+from.path+'到'+to.path+'\n'+error);
						}
					}
				}
			}
		}catch(error){
			console.log(error)
		}
	}
}

// status 的 值 含义
// export const enum Status {
// 	INDEX_MODIFIED,
// 	INDEX_ADDED, 1 增加
// 	INDEX_DELETED,
// 	INDEX_RENAMED, 3 重命名
// 	INDEX_COPIED,

// 	MODIFIED, 5修改
// 	DELETED, 6 删除
// 	UNTRACKED,
// 	IGNORED,
// 	INTENT_TO_ADD,

// 	ADDED_BY_US,
// 	ADDED_BY_THEM,
// 	DELETED_BY_US,
// 	DELETED_BY_THEM,
// 	BOTH_ADDED,
// 	BOTH_DELETED,
// 	BOTH_MODIFIED
// }

// this method is called when your extension is deactivated
function deactivate() {
	vscode.window.showInformationMessage('bye bye  from lams-patch!');
}

module.exports = {
	activate,
	deactivate
}
