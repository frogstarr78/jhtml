all: javascript.js index.js
	node index.js examples/example.jhtml

javascript.js: javascript.pegjs
	./node_modules/pegjs/bin/pegjs javascript.pegjs

test: javascript.js
	node test/*.js
