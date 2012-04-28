var fs = require('fs'),
    path = require('path'),
    jade = require('jade'),
    coffee = require('coffee-script'),
    less = require('less');

/**
 * 
 */
var jadelesscoffee = {
    version: '0.1.0',
    Compiler: require('./compiler').Compiler,
    Watcher: require('./watcher').Watcher,
    compile: function(dirname, destname) {
        var compiler = new jadelesscoffee.Compiler(dirname, destname);
        compiler.compile(dirname, dirname);
    }
};

for (var attribute in jadelesscoffee) exports[attribute] = jadelesscoffee[attribute];

//these are the defaults
/*var currentDirectory = fs.realpathSync('.');
var sourceDirectory = currentDirectory + '/src';
var outputDirectory = currentDirectory + '/build';

var watcher = new jadelesscoffee.Watcher(currentDirectory, sourceDirectory, outputDirectory);*/

