var parseString = require('xml2js').parseString;
var when = require('when');
var fs = require('fs');
var exec = require('child_process').exec;

var path = "/Users/amir/Projects/cd/ant";



var originalLog = console.log;
console.log = console.error = function (data, t) {
	if (t == 'actual!') originalLog(data);
}
var timer = function () {
	this.s = null;
	this.total = 0;
	this.start = function () {
		this.s = (new Date()).getTime();
	}
	this.end = function () {
		this.total += (new Date()).getTime()-this.s;
		this.s = null;
	}
}

var timers = new function () {
	var list = {};
	return {
		start: function (name) {
			return;
			if (!list[name]) list[name] = new timer();
			list[name].start();
		},
		end: function (name) {
			return;
			if (!name || !list[name]) return;
			list[name].end()
		},
		res: function () {
			return;
			var out = {};
			for (var t in list) {
				out[t] = list[t].total;
			}
			return out;
		}
	}
}

var Waiter = function (n, cb) {
	this.n = n+1;
	this.ok = function () {
		this.n--;
		if (this.n == 0) {
			cb();
		}
	}
	this.ok();
}
Array.prototype.pushcheck = function (item, eq) {
	if (this.length == 0) return this.push(item);
	if (eq(item, this[this.length-1])) return this.length;
	return this.push(item);
}
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


//
var parseFirstHunk = function(str, ind) {
	timers.start('parseFirstHunk');
	var header = /@@ -(\d+),(\d+) \+(\d+),(\d+) @@.*$/g;
	var match = header.exec(str[ind]);
	var s = [~~match[1], ~~match[3]];
	var l = [~~match[2]+s[0], ~~match[4]+s[1]];
	var curr = {
		type:'n',
		text: [],
		start: -1,
		length: 0
	};
	var state = 0;
	var i = ind+1;
	var changes = [];
	while ((s[0] < l[0] || s[1] < l[1]) && i < str.length) {
		if (str[i][0] == '+') {
			if (curr.type == 'n') {
				curr.type = 'a';
				curr.start = s[0];
				curr.text.push(str[i].substr(1));
				curr.length = 0;
			}else if (curr.type == 'd') {
				curr.type = 'c';
				curr.text.push(str[i].substr(1));
			}else if (curr.type == 'a' || curr.type == 'c') {
				curr.text.push(str[i].substr(1));
			}
			s[1]++;
		}else if (str[i][0] == '-') {
			if (curr.type == 'n') {
				curr.type = 'd';
				curr.start = s[0];
				curr.length = 1;
			}else if (curr.type == 'd') {
				curr.length++;
			}
			s[0]++;
		}else if (str[i][0] == ' ') {
			if (curr.type == 'n') {
				// nothing
			}else {
				changes.push(curr);
				curr = {
					type:'n',
					text: [],
					start: -1,
					length: 0
				};
			}
			s[0]++;
			s[1]++;
		}
		i++;
	}
	if (curr.type != 'n') {
		changes.push(curr);
	}
	timers.end('parseFirstHunk');
	return {
		changes: changes,
		end: i
	};
}
function gitDiff(file, from, to, path, cb) {
	timers.start('getDiff');
	var TYPES = {'a': 'addition', 'd': 'deletion', 'c': 'change'};
	timers.start('getDiff exec');
	exec('git diff ' + from + '..' + to + ' ' + file, {
		cwd: path
	}, function(error, stdout, stderr) {
		//originalLog(file, from, to, path);
		//originalLog(stdout);
		timers.end('getDiff exec');
		if (stderr.indexOf("fatal: ambiguous argument") == 0) {
			timers.end('getDiff');
			return cb("not exists");
		}
		var i = 4;
		var input = stdout.split(/\n/);
		if (input[1].indexOf('deleted file') == 0) {
			timers.end('getDiff');
			return cb("removed");
			return;
		}
		if (input[1].indexOf('new file') == 0) {
			timers.end('getDiff');
			return cb("added");
			return;
		}
		var changes = [];
		while (i+1<input.length) {
			if (input[i] == '\\ No newline at end of file') {
				i++;
				continue;
			}
			var out = parseFirstHunk(input, i);
			i = out.end;
			out.changes.forEach(function (change) {
				changes.push({
					type: TYPES[change.type],
					s: change.start,
					l: change.length,
					text: change.text.join('\n'),
					n: change.text.length
				});
			});
		}
		timers.end('getDiff');
		cb(changes);
	});

}

var changeCmp = function (c1, c2) {
	return c1.commit == c2.commit && c1.type == c2.type && c1.index == c2.index;
}


var commits = [];
fs.readFileSync('./commits').toString().split(/\n/).forEach(function (line) {
	var cmrex = /^commit ([0-9a-f]{40})$/g;
	var match = cmrex.exec(line);
	if (match == null) return;
	commits.push(match[1]);
});
commits.reverse();
//Added (A), Copied (C), Deleted (D), Modified (M), Renamed (R), changed (T), are Unmerged (U), are Unknown (X), or have had their pairing Broken (B).
var DIFF_CHANGES = {
	'A': 'added',
	'C': 'copied',
	'D': 'deleted',
	'M': 'modified',
	'R': 'renamed',
	'T': 'changed',
	'U': 'unmerged',
	'X': 'unknown',
	'B': 'broken'
};
var DJSet = function (n) {
	this.n = n;
	this.ref = new Array(n);
	for (var i=0;i<this.n;i++) this.ref[i] = i;
	this.find = function(i) {
		if (this.ref[i] == i) return i;
		return this.ref[i] = this.find(this.ref[i]);
	}
	this.union = function (i, j) {
		this.ref[this.find(i)] = this.find(j);
	}
	this.isolate = function (i) {
		if (this.ref[i] != i) {
			for (var j=0;j<this.n;j++) this.find(j);
			this.ref[i] = i;
			return;
		}
		var parent = -1;
		for (var j=0;j<this.n;j++) {
			if (parent == -1 && this.find(j) == i && i != j) {
				parent = j;
			}
			if (parent != -1 && this.find(j) == i) {
				this.ref[j] = parent;
			}
		}
		this.ref[i] = i;
	}
	this.add = function() {
		this.ref.push(this.n);
		this.n++;
		return this.n;
	}
	this.get = function () {
		var check = new Array(this.n);
		for (var i=0;i<this.n;i++) check[i] = false;
		var out = [];
		for (var i=0;i<this.n;i++) {
			if (check[i]) continue;
			var curr = [];
			for (var j=0;j<this.n;j++) {
				if (this.find(i) == this.find(j)) {
					curr.push(j);
					check[j] = true;
				}
			}
			out.push(curr);
		}
		return out;
	}
	this.toJSON = function () {
		return this.get();
	}
	this.friends = function (i) {
		var out = [];
		for (var j=0;j<this.n;j++) {
			if (i!=j && this.find(i) == this.find(j)) out.push(j);
		}
		return out;
	},
	this.step = function () {
		return JSON.parse(JSON.stringify(this.get()));
	}
}

// this is used to trim the full add address of files in clone detection result
var cpath = '/home-students/saboury/Desktop/T/ant/';
function readClone(cmid) {
	var c = JSON.parse(fs.readFileSync('./output/' + cmid + '.json').toString());
	c.clones = c.clones || [];
	for (var i=0;i<c.clones.length;i++) {
		for (var j=0;j<c.clones[i].length;j++) {
			c.clones[i][j].file = c.clones[i][j].file.substr(cpath.length);
			c.clones[i][j].originalLength = c.clones[i][j].length;
		}
	}
	return c;
}

var mapper = {};
var prev = readClone(commits.shift());
var Gene = [];

var updateMap = function () {
	timers.start('updateMap');
	mapper = {};
	Gene.forEach(function (g) {
		for (var j=0;j<g.clones.length;j++) {
			if (g.clones[j].file == '/dev/null') continue;
			mapper[g.clones[j].file] = mapper[g.clones[j].file] || [];
			mapper[g.clones[j].file].push({g: g, i: j}); // gene and index
		}
	});
	timers.end('updateMap');
}



for (var i=0;i<prev.clones.length;i++) {
	var g = {};
	g.clones = prev.clones[i];
	g.changes = [];
	g.set = new DJSet(g.clones.length);
	for (var j=0;j<g.clones.length;j++) {
		g.set.union(0, j);
		g.changes.pushcheck({commit: prev.commit, type: 'introduce', index: j, set: g.set.step()}, changeCmp);
	}
	Gene.push(g);
}
var prog = !false;
updateMap();
 if (prog) var pace = require('pace')(commits.length+1);
 if (prog) pace.op();
var Ind = 0;

commits.forEachAsync(function (commit, nextCommit) {
	Ind++;
	if (prog) pace.op();
	var commit = readClone(commit);
	exec('git diff-tree --follow --no-commit-id --name-status -M -r ' + commit.commit, {
		cwd: path
	}, function (error, stdout, stderr) {
		var files = stdout.split("\n").map(function (e) {return e.split(/\t/);});
		// console.log("Files: " + files);
		files.pop();
		exec('git checkout ' + commit.commit, {
			cwd: path
		}, function (error, stdout, stderr) {
			timers.start('files!');
			files.forEachAsync(function (e, nextChange) {
				var f = e[1];

				// console.log(f, "#", mapper[f] != undefined);
				if (mapper[f] == undefined) return nextChange();
				// console.error("!!!!!!!!", f);
				// console.log("files : " + mapper[f].length, DIFF_CHANGES[e[0][0]]);
				if (DIFF_CHANGES[e[0][0]] == 'deleted') {
					mapper[f].forEach(function (cl) {
						cl.g.set.isolate(cl.i);
						cl.g.changes.pushcheck({commit: commit.commit, type: 'delete', index: cl.i, set: cl.g.set.step()}, changeCmp);
						cl.g.clones[cl.i].start = -1;
						cl.g.clones[cl.i].file += ' @@ /dev/null';

					});
					// console.log(cl.g.clones);
					// console.log(cl.g.changes);
					// console.log("next change\n\n");
					return nextChange();
				}
				if (DIFF_CHANGES[e[0][0]] == 'modified' || DIFF_CHANGES[e[0][0]] == 'renamed') {
					// console.log("MODIF");
					if (DIFF_CHANGES[e[0][0]] == 'renamed') {
						var fnew = e[2];
						mapper[f].forEach(function (cl) {
							cl.g.clones[cl.i].file = fnew;
						});
						mapper[fnew] = mapper[f];
						delete mapper[f];
						f = fnew;
						//f = fnew;
					}
					gitDiff(f, prev.commit, commit.commit, path, function (diffs) {
						//console.log("diff " + JSON.stringify(diffs, null, 4), 'actual!');
						if (diffs.length==0) return nextChange();
						if (!diffs.forEach) return nextChange();
						mapper[f].forEach(function (cl) {
							// console.log("edditing " + JSON.stringify(cl.g.clones[cl.i], null, 4));
							var start = cl.g.clones[cl.i].start;
							var length = cl.g.clones[cl.i].length;
							var inc = false;
							diffs.forEach(function (diff) {
								// starts after clone
								if (diff.s > cl.g.clones[cl.i].start+cl.g.clones[cl.i].length-1) {
									// console.log("// starts after clone");
									return;
								}
								// end before clone
								if (diff.s+diff.l-1<cl.g.clones[cl.i].start) {
									start += diff.n-diff.l;
									// console.log("// end before clone");
									return;
								}
								// in the clone
								if (diff.s > cl.g.clones[cl.i].start && diff.s+diff.l < cl.g.clones[cl.i].start+cl.g.clones[cl.i].length) {
									length += diff.n-diff.l;
									inc = true;
									// console.log("// in the clone");
									return;
								}
								// change upper part
								if (diff.s <= cl.g.clones[cl.i].start && diff.s+diff.l < cl.g.clones[cl.i].start+cl.g.clones[cl.i].length) {
									start += diff.l-(cl.g.clones[cl.i].start-diff.s);
									length -= diff.l-(cl.g.clones[cl.i].start-diff.s);
									inc = true;
									// console.log("// change upper part");
									return;
								}
								
								// change lower part
								if (diff.s < cl.g.clones[cl.i].start+cl.g.clones[cl.i].length) {
									length -= cl.g.clones[cl.i].start+cl.g.clones[cl.i].length-diff.s;
									inc = true;
									// console.log("// change lower part");
									return;
								}
							});
							
							// console.log(cl.g.clones[cl.i].start, start);
							// console.log(cl.g.clones[cl.i].length, length);
							cl.g.clones[cl.i].start = start;
							cl.g.clones[cl.i].length = length;
							if (inc) {
								// console.log("INC");
								cl.g.set.isolate(cl.i);
								cl.g.changes.pushcheck({commit: commit.commit, type: 'modify-inc', index: cl.i, set: cl.g.set.step()}, changeCmp);
							}else {
								cl.g.changes.pushcheck({commit: commit.commit, type: 'modify', index: -1}, changeCmp);
							}
							
							// console.log(cl.g.changes);

						});
						// console.log("next change");
						nextChange();
					});
				}
			}, function () {
				timers.end('files!');
				timers.start('clones!');
				updateMap();
				commit.clones.forEach(function (group) {
					// console.log("Processing " + JSON.stringify(group, null, 4));
					var found = null;
					for (var z=0;z<group.length;z++) {
						var clone = group[z];
						if (mapper[clone.file] == undefined) continue;
						for (var i=0;i<mapper[clone.file].length;i++) {
							var cl = mapper[clone.file][i];
							if (cl.g.clones[cl.i].start == clone.start) {
								found = cl.g;
								break;
							}
							if (clone.start < cl.g.clones[cl.i].start && clone.start+clone.length >= cl.g.clones[cl.i].start+cl.g.clones[cl.i].length) {
								found = cl.g;
								break;
							}
						}
						if (found) {
							break;
						}
					}
					if (found == null) {
						// console.log("// new clone introduced");
						var g = {};
						g.clones = group;
						g.changes = [];
						g.set = new DJSet(g.clones.length);
						for (var j=0;j<g.clones.length;j++) {
							g.set.union(0, j);
							g.changes.pushcheck({commit: commit.commit, type: 'introduce', index: j, set: g.set.step()}, changeCmp);
						}
						Gene.push(g);
						return;
					}
					var checked = [];
					// console.log("already exists!");
					// console.log(group);
					// console.log(found);
					for (var i=0;i<group.length;i++) {
						var ok = false;
						for (var j=0;j<found.clones.length;j++) {
							if (group[i].file != found.clones[j].file) continue;
							if (checked.indexOf(j) != -1) continue;
							if ((group[i].start == found.clones[j].start) || (group[i].start < found.clones[j].start && group[i].start+group[i].length >= found.clones[j].start+found.clones[j].length)) {
								var os = found.clones[j].start;
								var ol = found.clones[j].length;
								found.clones[j].start = Math.min(group[i].start, found.clones[j].start);
								found.clones[j].length = Math.max(group[i].length, found.clones[j].length);
								checked.push(j);
								//console.error(j + ": " + found.set.friends(j).join(","), 'actual!');
								// console.log("i=" + i + " j=" + j);
								if (found.set.friends(j).length == 0) {// if (os != found.clones[j].start || ol != found.clones[j].length) {
									found.changes.pushcheck({commit: commit.commit, type: 'modify-con', index: j}, changeCmp);
								}
								ok = true;
								break;
							}
							// console.log("!! i=" + i + ", j=" + j);
						}
						if (!ok) {
							found.clones.push(group[i]);
							var ind = found.set.add()-1;
							found.changes.pushcheck({commit: commit.commit, type: 'introduce', index: ind, set: found.set.step()}, changeCmp);
							checked.push(ind);
						}
					}
					// console.log("E", checked);
					// console.log(group);
					// console.log(found);
					
					for (var i=0;i<checked.length;i++) {
						found.set.union(checked[0], checked[i]);
					}
					found.changes.pushcheck({commit: '-1', type: 'sumup', index: -1, set: found.set.step()}, changeCmp);
				})
				// console.log("going to next commit");
				prev = commit;
				timers.end('clones!');
				nextCommit();
			});	

		});	
		

		
	});

}, function () {
	// console.log("END");
	if (process.argv[2]) require('fs').writeFileSync("./"+process.argv[2], JSON.stringify(Gene, null, 4));
	else console.log(JSON.stringify(Gene, null, 4), 'actual!');
});	




