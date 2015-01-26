var fs = require('fs');


var data = JSON.parse(fs.readFileSync('./result.json').toString());

var binfo = JSON.parse(fs.readFileSync('./buginfo.json').toString());
var bugs = {};
binfo.forEach(function (commit) {
	commit.bugs.forEach(function (bug) {
		if (!bug.exists) return;
		bugs[commit.id] = bugs[commit.id] || [];
		bugs[commit.id].push(bug);
	});
});
var rbugs = [];
var res = [];
data.forEach(function (group) {
	var ng = {
		n: group.clones.length,
		bugs: [],
		set: group.set,
		files: group.clones,
		changes: []
	};
	for (var i=0;i<group.changes.length;i++) {
		var m = 0;
		var ind = i;
		var d = {
			commit: group.changes[i].commit
		};
		var s = null;
		var lasts = null;
		while (ind < group.changes.length && (group.changes[ind].commit == group.changes[i].commit || group.changes[ind].commit == '-1')) {
			if (group.changes[ind] == '-1') {
				s = group.changes[ind].set;
				continue;
			}
			//console.log(ind, group.changes[ind])
			if (group.changes[ind].set) {
				lasts = group.changes[ind].set;
			}

			var c = group.changes[ind];
			if (c.type == "introduce") {
				d.introduce = d.introduce || [];
				d.introduce.push(c.index);
			}
			if (c.type == "modify-inc") {
				d.inc = d.inc || [];
				d.inc.push(c.index);
			}
			if (c.type == "modify-con") {
				d.con = d.con || [];
				d.con.push(c.index);
			}
			if (c.type == "delete") {
				d.del = d.del || [];
				d.del.push(c.index);	
			}
			ind++;
		}
		
		if (d.inc && d.con) {
			for (var j=0;j<d.inc.length;j++) {
				if (d.con.indexOf(d.inc[j]) != -1) {
					d.inc[j] = -1;
				}
			}
			var ninc = [];
			for (var j=0;j<d.inc.length;j++) if (d.inc[j] != -1) ninc.push(d.inc[j]);
			d.inc = ninc;
			if (d.inc.length == 0) delete d.inc;
		}
		if (d.del) {
			for (var j=0;j<d.del.length;j++) {
				for (var k=0;k<ng.set.length;k++) {
					if (ng.set[k][0] == d.del[j] && ng.set[k][0].length > 1) throw "err!";
					if (ng.set[k][0] == d.del[j]) {
						ng.set.splice(k, 1);
					}
				}
			}
		}
		//if (d.inc || d.con || d.introduce || d.del) 
		i = ind-1;
		if (s != null) {
			d.set = group.changes[ind].set;
		}else if (lasts != null) {
			d.set = group.changes[i].set;
		}else {
			if (d.inc || d.con || d.introduce || d.del) {
				throw "err";
			}	
		}
		if (!d.inc && !d.con && !d.introduce && !d.del) {
			delete d.set;
		}else {
			//d.bugs = bugs[group.changes[i].commit];
			if (bugs[d.commit]) {
				ng.bugs.push({
					commit: d.commit,
					bugs: bugs[d.commit]
				});
			}
			
		}
		ng.changes.push(d);
		
		//i = ind-1;
	}
	res.push(ng);
});
var G = res;
// console.error(JSON.stringify(G, null, 4));
var commits = (function () {
	var commits = {};
	var lastCommit = null;
	fs.readFileSync('./commits').toString().split(/\n/).forEach(function (line) {
		var cmrex = /^commit ([0-9a-f]{40})$/g;
		var match = cmrex.exec(line);
		if (match != null) {
			lastCommit = match[1];
			commits[lastCommit] = {};
			return;
		}
		var cmrex = /^Date:   (.*)$/g;
		var match = cmrex.exec(line);
		if (match != null) {
			commits[lastCommit].date = new Date(match[1]);
			return;
		}
	});
	return commits;
})();
var res = [];

G.forEach(function (gene) {
	for (var i=0;i<gene.n;i++) {
		for (var j=i+1;j<gene.n;j++) {
			var pair = {
				len: gene.files[i].originalLength,
				indexes: [i, j],
				evolution: []
			};
			var state = {};
			var sim = false;
			var start = false;
			for (var k=0;k<gene.changes.length;k++) {
				var c = gene.changes[k];

				if (c.introduce && c.introduce.indexOf(i) != -1) {
					state[i] = true;
				}
				if (c.introduce && c.introduce.indexOf(j) != -1) {
					state[j] = true;
				}
				if (!state[i] || !state[j]) continue;
				// console.error(c);
				var e = {
					commit: c.commit,
					date: commits[c.commit].date.getTime()/1000
				};

				var changed = false;
				var del = false;
				var add = false;
				var tempSim = false;
				if (c.set) {
					c.set.forEach(function (set) {
						if (set.indexOf(i) == -1 || set.indexOf(j) == -1) return;
						if (!sim) {
							add = true;
						}
						sim = true;
						tempSim = true;
					});
					if (sim && !tempSim) {
						add = true;
						sim = false;
					}
				}
				if (tempSim == true) start = true;
				if (!start) continue;
				e.sync = sim;
				if (c.con) {
					if (c.con.indexOf(i) != -1 || c.con.indexOf(j) != -1) {
						changed = true;
						add = true;
					}
				}
				if (c.inc) {
					if (c.inc.indexOf(i) != -1 || c.inc.indexOf(j) != -1) {
						changed = true;
						add = true;
					}
				}
				e.changed = changed;
				if (c.del) {
					if (c.del.indexOf(i) != -1 || c.del.indexOf(j) != -1) {
						del = true;
						add = true;
					}
				}

				//e.del = del;
				e.changed = e.changed || del;

				if (add) {
					gene.bugs.forEach(function (commit) {
						if (commit.commit == c.commit) {
							e.bugfix = true;
							commit.bugs.forEach(function (bug) {
								if (bug.status.indexOf("RESOLVED") == -1 && bug.status.indexOf("fixed") == -1) return;
								var bugTime = new Date(bug.opened);
								bugTime = bugTime.getTime();
								for (var ind=pair.evolution.length-1;ind>=0;ind--) {
									if (commits[pair.evolution[ind].commit].date.getTime() > bugTime) {
										pair.evolution[ind].buggy = true;
									}
								}
							});
						}
					});

					pair.evolution.push(e);
				}
				if (del) break;
			}

			if (pair.evolution.length > 0) res.push(pair);

		}
	}
});

var sm = {
	'START': {
		'I': 'UNKNOWN',
		'C': 'UNC'
	},
	'UNC': {
		'I': 'INC',
		'C': 'SYNC'
	},
	'SYNC': {
		'I': 'DIV',
		'C': 'SYNC'
	},
	'DIV': {
		'I': 'DIV',
		'C': 'LP'
	},
	'LP': {
		'I': 'LPDIV',
		'C': 'LP'
	},
	'LPDIV': {
		'I': 'LPDIV',
		'C': 'LP'
	},
	'INC': {
		'I': 'INC',
		'C': 'LP'
	}
}

res.forEach(function (g) {
	var state = 'C';
	var pattern = 'START';
	g.evolution.forEach(function (e) {
		if (state == 'C' && e.sync) {
			e.type = 'CON';
		}else if (state == 'C' && !e.sync) {
			e.type = 'DIV';
			state = 'I';
		}else if (state == 'I' && e.sync) {
			e.type = 'RESYNC';
			state = 'C';
		}else if (state == 'I' && !e.sync) {
			e.type = 'INC';
		}
		pattern = sm[pattern][state];
		e.pattern = pattern;
	});
	g.pattern = pattern;
});
fs.writeFileSync('./combined.json', JSON.stringify(res, null, 4));

//console.log(JSON.stringify(res, null, 4));