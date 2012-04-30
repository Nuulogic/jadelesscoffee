var ScopeLocker = require('./scopelocker').ScopeLocker;
var fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    jade = require('jade'),
    coffee = require('coffee-script'),
    less = require('less');
    

//borrowed from less. Some of this is needless for the compiler, but in here in case we get there later
if (typeof environment === "object" && ({}).toString.call(environment) === "[object Environment]") {
    // Rhino
    // Details on how to detect Rhino: https://github.com/ringo/ringojs/issues/88
    if (typeof(window) === 'undefined') { jadelesscoffee = {} }
    else                                { jadelesscoffee = window.jadelesscoffee = {} }
    jadelesscoffee.mode = 'rhino';
} else if (typeof(window) === 'undefined') {
    // Node.js
    jadelesscoffee = exports,
    jadelesscoffee.mode = 'node';
} else {
    // Browser
    if (typeof(window.jadelesscoffee) === 'undefined') { window.jadelesscoffee = {} }
    jadelesscoffee = window.jadelesscoffee,
    jadelesscoffee.mode = 'browser';
}

jadelesscoffee.Compiler = function(sourceDirectory, outputDirectory, incremental) {
    this.sourceDirectory = path.dirname(sourceDirectory) + '/' + path.basename(sourceDirectory);
    this.outputDirectory = path.dirname(outputDirectory) + '/' + path.basename(outputDirectory);
    this.incremental = (incremental == true);

    if (this.incremental && !jadelesscoffee.Compiler.silent) {console.log('Incremental compile started...');}

    this.compileCount = 0;

    this.compileHistory = {};
    //if incremental load up the .jlchistory
    try {
        var history = fs.readFileSync(this.sourceDirectory + '/.jlchistory', 'utf8');
        var historyLines = history.split("\n");
        for (var i = historyLines.length - 1; i >= 0; i--) {
            var line = historyLines[i];
            var lineParts = line.split('|');
            this.compileHistory[lineParts[0]] = lineParts[1];
        };
    } catch(err) {
        //assume no history file.
    }
}

jadelesscoffee.Compiler.EXTENSIONS_REGEX = /\.less$|\.coffee$|\.jade$/;
jadelesscoffee.Compiler.silent = false;
jadelesscoffee.Compiler.prototype = {
    /**
     *
     */
    buildJadeFile: function(filename) {
        if (filename) {
            //read in the jade file
            var data = fs.readFileSync(filename, 'utf8');

            var jadeCompiler = jade.compile(data, {pretty: true});
            var jadeHtml = jadeCompiler({DEBUG: true, COMPILE_TIME: new Date()});

            //write to the output directory
            var pathToBuildFile = filename.replace(this.sourceDirectory, this.outputDirectory).replace(/\.jade$/, '.html');
            //make sure the path exists
            if (!path.exists(path.dirname(pathToBuildFile)))
                mkdirp(path.dirname(pathToBuildFile), 0755);
            fs.writeFile(pathToBuildFile, jadeHtml);

            this.compileCount++;
        }
    },
    /**
     * For the dream one day when I can get the file name in the callback and have a nice clean async compile.
     */
    onJadeFileRead: function(error, data) {
        if (error) throw error;
        var jadeString = jade.compile(data, {pretty: true});
    },

    /**
     *
     */
    buildLessFile: function(filename) {
        if (filename) {
            //read in the jade file
            var data = fs.readFileSync(filename, 'utf8');

            less.render(data, {pretty: true}, ScopeLocker.lock(this, function(e, css) {
                var pathToBuildFile = filename.replace(this.sourceDirectory, this.outputDirectory).replace(/\.less$/, '.css');
                //make sure the path exists
                if (!path.exists(path.dirname(pathToBuildFile)))
                    mkdirp(path.dirname(pathToBuildFile), 0755);
                fs.writeFile(pathToBuildFile, css);
                this.compileCount++;
            }));
        }
    },

    /**
     *
     */
    buildCoffeeFile: function(filename) {
        if (filename) {
            //read in the jade file
            var data = fs.readFileSync(filename, 'utf8');

            var coffeeJs = coffee.compile(data, {pretty: true});

            //write to the output directory
            var pathToBuildFile = filename.replace(this.sourceDirectory, this.outputDirectory).replace(/\.coffee$/, '.js');
            //make sure the path exists
            if (!path.exists(path.dirname(pathToBuildFile)))
                mkdirp(path.dirname(pathToBuildFile), 0755);
            fs.writeFile(pathToBuildFile, coffeeJs);
            this.compileCount++;
        }
    },
    /**
     * Compiles all files in a directory and its subdirectories and outputs them to the destination directory
     */ 
    compile: function(dirname, baseDir) {
        if (baseDir == undefined) baseDir = dirname;
        if (!path.exists(dirname)) return;
        var files = fs.readdirSync(dirname);
        for (var i = files.length - 1; i >= 0; i--) {
            var filename = baseDir + '/' + files[i];
            var stats = fs.statSync(filename);
            //We need to get the data on this file. If it's a directory we want to recurse this on it as well.
            try {
                if (stats.isDirectory()) {
                    this.subCompile(filename, filename);
                    continue;
                }
            } catch(error) {
                continue;
            }

            if (!jadelesscoffee.Compiler.EXTENSIONS_REGEX.test(filename))
                continue;

            if (!this.incremental || (this.incremental && this.compileHistory[filename] != stats.mtime)) {
                this.compileFile(filename);
                this.compileHistory[filename] = stats.mtime;
            }
        };
        //compile is actually complete here.
        if (this.incremental) {
            this.saveHistory();
        }
    },
    subCompile: function(dirname, baseDir) {
        if (baseDir == undefined) baseDir = dirname;
        if (!path.exists(dirname)) return;
        var files = fs.readdirSync(dirname);
        for (var i = files.length - 1; i >= 0; i--) {
            var filename = baseDir + '/' + files[i];
            var stats = fs.statSync(filename);
            //We need to get the data on this file. If it's a directory we want to recurse this on it as well.
            try {
                if (stats.isDirectory()) {
                    this.subCompile(filename, filename);
                    continue;
                }
            } catch(error) {
                continue;
            }

            if (!jadelesscoffee.Compiler.EXTENSIONS_REGEX.test(filename))
                continue;

            if (!this.incremental || (this.incremental && this.compileHistory[filename] != stats.mtime)) {
                this.compileFile(filename);
                this.compileHistory[filename] = stats.mtime;
            }
        };
    },
    /**
     * Compiles a file based on its extension.
     *
     * @note This will only compile if a compilation is not currently underway. This way if there's a massive save across multiple files, it doesn't force this event over and over again.
     */
    compileFile: function(filename) {
        var extension = path.extname(filename);
        switch(extension) {
            case '.jade':
                this.buildJadeFile(filename);
                break;
            //less
            case '.less':
                this.buildLessFile(filename);
                break;
            //coffee
            case '.coffee':
                this.buildCoffeeFile(filename);
                break;
        };
    },
    saveHistory: function() {
        var historyString = '';
        for (var filename in this.compileHistory) {
            historyString += filename + '|' + this.compileHistory[filename] + '\n';
        }
        fs.writeFile(this.sourceDirectory + '/.jlchistory', historyString, 'utf8', function(error) {
            if (error && !jadelesscoffee.Compiler.silent)
                console.log(error);
        });
    }
}