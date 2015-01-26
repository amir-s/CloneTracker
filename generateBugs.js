var fs = require('fs');

var gitRepoPath = '/Users/amir/Projects/cd/ant';

var result = [];
// commits
// log is generated by "git log --all"

var log = fs.readFileSync('commits').toString().split("\n");
var commits = [];

var done = false;
for (var i=0;i<log.length;i++) {
	if (/^commit [0-9a-f]{40}$/.test(log[i])) {
		done = false;
	}
	if (done) continue;
	var c = {};
	c.id = log[i].substr("commit ".length);
	i++;
	c.author = log[i].substr("Author: ".length);
	i++;
	c.date = log[i].substr("Date:   ".length);
	i+=2;
	c.message = log[i].substr("    ".length);
	i++;
	while (log[i].indexOf('    ') === 0) {
		c.message += '\t'+log[i].substr("    ".length);
		i++;
	}
	if (c.message.indexOf("\t\tgit-svn-id: https://svn.apache.org") != -1) c.message = c.message.substr(0, c.message.indexOf("\t\tgit-svn-id: https://svn.apache.org")-1);
	c.bugs = [];
	var bugRegex = /\b(?:(?:Bug[\- ]#?)|(?:Bug(?:zilla)? report\:? )|(?:bugzilla id )|(?:bug\: )|(?:bugzilla(?: request)?\: )|(?:bug# )|(?:defect )|(?:(?:bug )?fix of )|(?:(?:bug )?fix for )|(?:BZ\:)|(?:BUG ?ID )|(?:B(?:Z|R)\:? )|(?:Bugzilla is?sue ? #?)|(?:https?\:\/\/(?:w{3}\.)?\w+\.org\/bugzilla\/show_bug\.cgi\?id\=)|(?:bugrep )|(?:bugzilla )|(?:bug like )|(?:issue ))(\d+)/ig;
	//bugRegex = /\b(\d{3,})\b/g;
	var match = null;
	//if (!/\bPR(\:|s)?\b/ig.test(c.message)) {
		while (match = bugRegex.exec(c.message)) {
			//console.error(match[1]);
			c.bugs.push({id: match[1]});
		}
//	}
	var nbug = /#(\d{3,})/g;
	match = null;
	if (!/\bPR(\:|s)?\b/ig.test(c.message)) {
		while (match = nbug.exec(c.message)) {
			var found = false;
			for (var j=0;j<c.bugs.length;j++) {
				if (c.bugs[j].id == match[1]) found = true;
			}
			if (!found) c.bugs.push({id: match[1]});
		}
	}
	
	done = true;
	commits.push(c);
}
fs.writeFileSync('./bugs.json', JSON.stringify(commits, null, 4));
//console.log(JSON.stringify(commits, null, 4));
console.log("Done.");
process.exit();
