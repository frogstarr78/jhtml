var util = require('util');
var fs   = require('fs');
var js   = require('./javascript.js');

var AUTOINDENT = false;
var UPCASE = false;
var XML_COMPLIANT = false;

function debug () { console.dir(this, {depth: null}); };

function document (args, locals) {
	this.tree = args.expressions.map(function (expr) { return new node(expr, locals); });
	this.locals = locals||{};
	return this;
}

Object.prototype.assign = function ( other ) {
	Object.keys(other).forEach(function (key, i, arry) {
		this[key] = other[key];
	});
}

Object.prototype.forEach = function (cb) {
	Object.keys(this).forEach(cb);
}
function typer( arg, locals ) {
	switch( arg.type ) {
		case 'Literal':
			return arg.value
			break;
		case 'Identifier':
			if ( locals[arg.name] === undefined ) { 
					throw new Error(util.format('Missing value for "%s"', arg.name));
			} else {
				return locals[arg.name];
			}
			break;
		case 'BinaryExpression':
			//{ type: 'BinaryExpression', operator: '+', left: { type: 'Literal', value: 'Hello ' }, right: { type: 'Identifier', name: 'who' } }
			//{ type: 'BinaryExpression', operator: '+', left: { type: 'Literal', value: 'Hello ' }, right: { type: 'Identifier', name: 'who' } }
			//{ type: 'BinaryExpression', operator: '+', left: { type: 'BinaryExpression', operator: '+', left: { type: 'Literal', value: 'Say hello ' }, right: { type: 'Identifier', name: 'who' } }, right: { type: 'Literal', value: ' everyone.' } } 
			if ( arg.operator === '+' ) {
				return typer(arg.left, locals) + typer(arg.right, locals);
			}
			break;
		case 'AssignmentExpression':
			//{ type: 'AssignmentExpression', operator: '=', left: { type: 'Identifier', name: 'class' }, right: { type: 'Literal', value: 'content2' } }
			if ( arg.operator === '=' ) {
				o = {}
				o[arg.left.name] = arg.right.value;
				return o;
			}
			break;
		default:
			console.log("Unknown type '%s'", arg.type);
			debug.apply(arg);
			break;
	}
}

function node (obj, locals) {
	this.locals = locals||{};
	this.name = obj.callee.name;
	this.attributes = {};
	this.content = '';
	this.children = []
	var self = this;
	obj.arguments.forEach(function (arg, i, arry) {
		switch ( arg.type ) {
			case 'CallExpression':
				self.children.push(new node(arg, locals));
				break;
			case 'AssignmentExpression':
				if ( arg.operator === '=' ) {
					self.attributes[arg.left.name] = typer(arg.right, self.locals);
				}
				break;
			case 'Literal':
				switch ( self.name.toLowerCase() ) {
					case 'doctype':
						self.attributes[arg.value] = arg.value;
						break;
					default: 
						self.content += typer(arg, self.locals);
						break;
				}
				break;
			case 'BinaryExpression':
				self.content += typer(arg, self.locals)
				break;
			default:
				console.log("Unknown type '%s'", arg.type);
				debug.apply(arg);
				break;
		}		
	});

	return this;
}

node.prototype.attr_to_string = function () {
	var r = [];
	var self = this;
	this.attributes.forEach(function (key, i, arry) {
		v = self.attributes[key];
		quote_char = v.indexOf('"') > -1 ? "'" : '"';

		switch ( self.name.toLowerCase() ) {
			case 'doctype':
				r.push(util.format("%s", key));
				break;
			default:
				r.push(util.format("%s=%s%s%s", key, quote_char, v, quote_char));
				break;
		}
	})
	return r.join(' ');
}
node.prototype.render = function () {
	switch ( this.name.toLowerCase() ) {
		case 'doctype':
			return util.format('<!%s %s>', this.name, this.attr_to_string());
			break;
		case 'hr':
		case 'br':
		case 'img':
		case 'input':
		case '':
			end_fmt = XML_COMPLIANT ? '/>' : '>'
			if ( Object.keys(this.attributes).length > 0 ) {
				return util.format('<%s %s%s', this.name, this.attr_to_string(), end_fmt);
			} else {
				return util.format('<%s%s', this.name, this.content, end_fmt);
			}

			break;
		case 'cdata':
			var content = this.content;
			return util.format('<![%s[ %s ]]>', this.name, this.content);
			break;
		default:
			var content = this.content;
			this.children.map(function (child) { content += child.render(); });

			if ( Object.keys(this.attributes).length > 0 ) {
				return util.format('<%s %s>%s</%s>', this.name, this.attr_to_string(), content, this.name);
			} else {
				return util.format('<%s>%s</%s>', this.name, content, this.name);
			}
			break;
	}
}

node.prototype.debug = debug;
document.prototype.debug = debug;
document.prototype.render = function () { 
	return this.tree.map(function (leaf) { return leaf.render(); }).join(AUTOINDENT ? "\n" : '');
};
document.prototype.print = function () { 
	console.log(this.render());
};
document.prototype.writeSync = function (path) { 
	fs.writeFileSync(path, this.render());
};

exports.document = document;


function decode (code, locals) {
	return new document(js.parse(code).body[0].expression, locals);
}
exports.decode = decode;

function parse (filepath, locals) {
	if ( ! fs.existsSync(filepath) ) {
		console.error("File at filepath '%s' does not exist", filepath);	
		return null;
	}
	return decode(fs.readFileSync(filepath).toString(), locals);
}
exports.parse = parse;

input_paths = process.argv.slice(2);
if ( input_paths.length > 0 && input_paths[0] !== '' && input_paths[0] !== undefined ) {
	var argv = require('minimist')(input_paths, {boolean: ['a', 'autoident', 'u', 'upcase', 'x', 'xml'], string: ['o', 'outfile']});
	AUTOINDENT = argv.a || argv.autoident;
	UPCASE     = argv.u || argv.upcase;
	if ( argv.o ) {
		argv._.forEach(function (path, i, arry) {
			parse(path, argv).writeSync(argv.o[i]);
		});
	} else {
		argv._.forEach(function (path) { parse(path, argv).print() });
	}
}
