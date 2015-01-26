var parseString = require('xml2js').parseString;
var when = require('when');
var fs = require('fs');
var exec = require('child_process').exec;
Array.prototype.forEachAsync = function (cb, end) {
	var _this = this;
	setTimeout(function () {
		var index = 0;
		function next() {
			index++;
			if (index >= _this.length) {
				end();
				return;
			}
			cb(_this[index], next);
		}
		if (_this.length == 0) {
			end();
		}else {
			cb(_this[0], next);
		}
	}, 0);
}
var path = "/path/to/folder";
var projectName = "ant";
var NiCadPath = '/path/to/NiCad-3.5';
// path+"/"+projectName should be the project

function getCommits() {
	var deferred = when.defer();
	exec('git log --all > ../commits', {
		cwd: path + '/' + projectName
	}, function(error, stdout, stderr) {
		var commits = [];
		stdout = fs.readFileSync('./commits').toString();
		stdout.split(/\n/).forEach(function (line) {
			var cmrex = /^commit ([0-9a-f]{40})$/g;
			var match = cmrex.exec(line);
			if (match == null) return;
			commits.push(match[1]);
		});
		deferred.resolve(commits.reverse());
	});
	return deferred.promise;
}
var idd = 1;
function generateClones(commit) {
console.log("generating for [" + (idd++) + "] " + commit);
	var deferred = when.defer();
	exec('git checkout ' + commit , {
		cwd: path + '/' + projectName
	}, function (error, stdout, stderr) {
		console.log("checkout");
		exec('rm ' + projectName + '_* -r' , {
			cwd: path
		}, function (error, stdout, stderr) {
			console.log("removed old reports");
			exec(NiCadPath + '/nicad3 functions java ' + path + '/' + projectName + ' type2' , {
				cwd: NiCadPath
			}, function (error, stdout, stderr) {
				console.log(commit + " generated");
				deferred.resolve();
			});
		});
	});
	return deferred.promise;
}
function readClones() {
	var deferred = when.defer();
	if (!fs.existsSync(path + '/' + projectName + '_functions-blind-clones/' + projectName + '_functions-blind-clones-0.0-classes.xml')) {
		return deferred.resolve([]);
	}
	var xml = fs.readFileSync(path + '/' + projectName + '_functions-blind-clones/' + projectName + '_functions-blind-clones-0.0-classes.xml').toString();
	parseString(xml, function (err, result) {
		var groups = [];
		
		result.clones.class = result.clones.class || [];
		result.clones.class.forEach(function (cl) {
			var clones = [];
			cl.source.forEach(function (src) {
				clones.push({
					start: ~~src.$.startline,
					length: src.$.endline-src.$.startline+1,
					file: src.$.file,
					sim: ~~cl.$.similarity
				});
			});
			groups.push(clones);
		});
		console.log(JSON.stringify(groups, null, 4));
		deferred.resolve(groups);
	});
	return deferred.promise;
}
function getClones(commit, cb) {
	when(generateClones(commit)).then(readClones).then(function (clones) {
		cb(clones);
	});
}
var dnd = 0;
when(getCommits()).then(function (commits) {
	
	commits.forEachAsync(function (commit, next) {
		getClones(commit, function(clones) {
			fs.writeFileSync('./output/' + commit + '.json', JSON.stringify({commit: commit, clones: clones}, null, 4));
			console.log("done " + (++dnd) + " from " + commits.length);
			next();
		});
	}, function () {
		deferred.resolve();
	});
	return deferred.promise;
}).then(function () {
	console.log("All done.");
	//console.log(JSON.stringify(data, null, 4));
	// fs.writeFileSync('./clones.json', JSON.stringify(data, null, 4));
});