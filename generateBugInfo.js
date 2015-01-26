var fs = require('fs');
var exec = require('child_process').exec;
var request = require('request');
var cheerio = require('cheerio');
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
	}, 0)
}

var commits = JSON.parse(fs.readFileSync("bugs.json").toString());
var all = commits.reduce(function (s, el) {
	return el.bugs.length+s;
}, 0);
var ind = 0;
commits.forEachAsync(function (commit, nextCommit) {
	if (commit.bugs.length == 0) return nextCommit();
	var b = [];
	var bugs = commit.bugs;
	bugs.forEachAsync(function (bug, next) {
		console.error(ind++, all);
		request('https://issues.apache.org/bugzilla/show_bug.cgi?id=' + bug.id, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var $ = cheerio.load(body);
				if ($("#error_msg").text().indexOf("does not exist")!=-1) {
					bug.exists = false;
				}else {
					bug.exists = true;
					bug.status = $("#static_bug_status").text().trim().replace(/\n\s+/g, ' ');
					bug.component = $("#field_container_component").text().trim();
					var d = /(\d+)\-(\d+)\-(\d+) (\d+)\:(\d+).*/.exec($("#bz_show_bug_column_2").find("th.field_label").next().html());
					var d2 = /(\d+)\-(\d+)\-(\d+) (\d+)\:(\d+).*/.exec($("#bz_show_bug_column_2").find("th.field_label").parent().next().find("th.field_label").next().html());
					bug.opened = new Date(d[1], d[2], d[3], d[4], d[5]).toISOString();
					bug.modified = new Date(d2[1], d2[2], d2[3], d2[4], d2[5]).toISOString();
					console.error(bug);
				}
				next();
			}else {
				console.error("!"+error);
			}
		});
	}, function () {
		//commit.bugs = b;
		nextCommit();
	});
	
}, function () {
	fs.writeFileSync('./buginfo.json', JSON.stringify(commits, null, 4));
	console.log("Done!");
})