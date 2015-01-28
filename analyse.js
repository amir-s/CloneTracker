var fs = require('fs');

var data = JSON.parse(fs.readFileSync('./combined.json').toString());

var F1 = function () {
	var C = {};
	data.forEach(function (g) {
		var bug = false;
		g.evolution.forEach(function (e) {
			if (e.buggy) bug = true;
		});
		C[g.pattern] = C[g.pattern] || {true: 0, false: 0};
		C[g.pattern][bug]++;
	});

	console.log(['evolutionary pattern','buggy','not buggy'].join(","));
	for (var t in C) {
		console.log([t,C[t][true],C[t][false]].join(","));
	}
};


var F2 = function () {
	var C = {};
	data.forEach(function (g) {
		var bug = false;
		var count = {};
		g.evolution.forEach(function (e) {
			if (e.buggy) bug = true;
			count[e.type] = count[e.type] || 0;
			count[e.type]++;
		});
		for (var t in count) {
			C[t] = C[t] || {true: 0, false: 0};
			C[t][bug] += count[t];
		}
	});

	console.log(['change','#buggy','#not buggy'].join(","));
	for (var t in C) {
		console.log([t,C[t][true],C[t][false]].join(","));
	}
};

var F3 = function () {
	var C = {};
	data.forEach(function (g) {
		for (var i=1; i<g.evolution.length; i++) {
			var prev = g.evolution[i-1];
			var e = g.evolution[i];
			var bug = false;
			for (var j=i;j<g.evolution.length;j++) {
				if (!g.evolution[j].buggy) continue;
				bug = true;
				break;
			}
			C[prev.pattern] = C[prev.pattern] || {};
			C[prev.pattern][e.type] = C[prev.pattern][e.type] || {true: 0, false: 0};
			C[prev.pattern][e.type][bug]++;
		}
	});
	console.log(['evolutionary pattern','change','#buggy','#not buggy'].join(","));
	for (var p in C) {
		for (var t in C[p]) {
			console.log([p,t,C[p][t][true],C[p][t][false]].join(","));
		}
	}
};

var F4 = function () {
	var C = {};
	data.forEach(function (g) {
		var size = g.len<=50?'small':'big';
		for (var i=0; i<g.evolution.length; i++) {
			var e = g.evolution[i];
			var bug = false;
			for (var j=i;j<g.evolution.length;j++) {
				if (!g.evolution[j].buggy) continue;
				bug = true;
				break;
			}
			C[e.pattern] = C[e.pattern] || {'big': {true: 0, false: 0}, 'small': {true: 0, false: 0}};
			C[e.pattern][size][bug]++;
		}
	});
	console.log(['evolutionary pattern','size','#buggy','#not buggy'].join(","));
	for (var p in C) {
		for (var s in C[p]) {
			console.log([p,s,C[p][s][true],C[p][s][false]].join(","));
		}
	}
};

var F5 = function () {
	var C = {};
	data.forEach(function (g) {
		var mx = -1;
		var buggy = false;
		var agg = {};
		for (var i=1; i<g.evolution.length; i++) {
			var e = g.evolution[i];
			var mx = Math.max(mx, e.date-g.evolution[i-1].date);
			var l = 'More than Year';

			if (mx <= 24*60*60*365) l = 'One Year';
			if (mx <= 24*60*60*30)  l = 'One Month';
			if (mx <= 24*60*60*7)   l = 'One Week';
			if (mx <= 24*60*60*1)   l = 'One Day';
			agg[l] = agg[l] || 0;
			agg[l]++;
			if (e.buggy) {
				buggy = true;
			}
			if (e.bugfix) {
				for (var l in agg) {
					C[l] = C[l] || {true: 0, false: 0};
					C[l][buggy] += agg[l];
				}
				buggy = false;
				mx = -1;
				agg = {};
			}
		}
		if (mx != -1) {
			for (var l in agg) {
				C[l] = C[l] || {true: 0, false: 0};
				C[l][buggy] += agg[l];
			}
			buggy = false;
			mx = -1;
			agg = {};
		}
	});
	console.log(['Change Interval','#buggy','#not buggy'].join(","));
	for (var p in C) {
		console.log([p,C[p][true],C[p][false]].join(","));
	}
};

// F5();
