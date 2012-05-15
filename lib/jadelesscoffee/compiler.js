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
    this.sourceDirectory = path.join(path.dirname(sourceDirectory), '/', path.basename(sourceDirectory));
    this.outputDirectory = path.join(path.dirname(outputDirectory), '/', path.basename(outputDirectory));
    this.incremental = (incremental == true);

    this.compileCount = 0;

    this.compileHistory = {};
    //if incremental load up the .jlchistory
    try {
        var history = fs.readFileSync(path.join(this.sourceDirectory, '/.jlchistory'), 'utf8');
        var historyLines = history.split("\n");
        for (var i = historyLines.length - 1; i >= 0; i--) {
            var line = historyLines[i];
            var lineParts = line.split('|');

            if (lineParts[1] == 'undefined') continue;
            
            this.compileHistory[lineParts[0]] = lineParts[1];
        };
    } catch(err) {
        //assume no history file.
    }
}

jadelesscoffee.Compiler.EXTENSIONS_REGEX = /\.less$|\.coffee$|\.jade$/;
jadelesscoffee.Compiler.silent = false;
jadelesscoffee.Compiler.verbose = false;
jadelesscoffee.Compiler.prototype = {
    /**
     *
     */
    buildJadeFile: function(filename, callback) {
        if (filename) {
            //read in the jade file
            var data = fs.readFileSync(filename, 'utf8');

            try {
                var jadeCompiler = jade.compile(data, {pretty: true});
                var jadeHtml = jadeCompiler({DEBUG: true, COMPILE_TIME: new Date()});
            } catch(err) {
                callback(err, filename);
                return;
            }

            //write to the output directory
            var pathToBuildFile = filename.replace(this.sourceDirectory, this.outputDirectory).replace(/\.jade$/, '.html');
            //make sure the path exists
            if (!path.existsSync(path.dirname(pathToBuildFile)))
                mkdirp(path.dirname(pathToBuildFile), 0755);

            if (jadelesscoffee.Compiler.verbose) { console.log(filename + ' finished Jade compile; Writing to ' + pathToBuildFile) }

            fs.writeFile(pathToBuildFile, jadeHtml);

            this.compileCount++;
                callback(null, filename);
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
    buildLessFile: function(filename, callback) {
        if (filename) {
            //read in the jade file
            var data = fs.readFileSync(filename, 'utf8');
            var options = {
                pretty: true, 
                compress: false,
                yuicompress: false,
                optimization: 1,
                silent: false,
                color: true,
                paths: [path.dirname(filename)],
                strictImports: false };

            try {
                less.render(data, options, ScopeLocker.lock(this, function(e, css) {
                    if (e) {
                        callback(e.message, filename)
                        return;
                    }
                    
                    var pathToBuildFile = filename.replace(this.sourceDirectory, this.outputDirectory).replace(/\.less$/, '.css');
                    //make sure the path exists
                    if (!path.existsSync(path.dirname(pathToBuildFile)))
                        mkdirp(path.dirname(pathToBuildFile), 0755);
                
                    if (jadelesscoffee.Compiler.verbose) { console.log(filename + ' finished Less compile; Writing to ' + pathToBuildFile) }

                    fs.writeFile(pathToBuildFile, css);
                    this.compileCount++;
                    callback(null, filename);
                }));
            }
            catch (err) {
                if (typeof(err) == 'object')
                    callback("Syntax Error in " + filename + " at line " + err.line + ',' + err.column + ':\t' + err.message + '\n' + err.extract.join('\n'), filename);
                else
                    callback(err, filename);
            }
        }
    },

    /**
     *
     */
    buildCoffeeFile: function(filename, callback) {
        if (filename) {
            //read in the jade file
            var data = fs.readFileSync(filename, 'utf8');

            try {
                var coffeeJs = coffee.compile(data, {pretty: true});
            }
            catch(err) {
                callback(err, filename);
                return;
            }

            //write to the output directory
            var pathToBuildFile = filename.replace(this.sourceDirectory, this.outputDirectory).replace(/\.coffee$/, '.js');
            //make sure the path exists
            if (!path.existsSync(path.dirname(pathToBuildFile)))
                mkdirp(path.dirname(pathToBuildFile), 0755);

            if (jadelesscoffee.Compiler.verbose) { console.log(filename + ' finished CoffeeScript compile; Writing to ' + pathToBuildFile) }

            fs.writeFile(pathToBuildFile, coffeeJs);
            this.compileCount++;
            callback(null, filename);
        }
    },
    /**
     * Compiles all files in a directory and its subdirectories and outputs them to the destination directory
     */ 
    compile: function(dirname, baseDir) {
        if (baseDir == undefined) baseDir = dirname;
        if (!path.existsSync(dirname)) {
            if (!jadelesscoffee.Compiler.silent) console.log('Path ' + dirname + ' does not exist.');
            return;
        }

        if (this.incremental && !jadelesscoffee.Compiler.silent) {console.log('Incremental compile started...');}

        this.subCompile(dirname, baseDir);
        //compile is actually complete here.
        if (this.incremental) {
            this.saveHistory();
        }
    },
    subCompile: function(dirname, baseDir) {
        if (baseDir == undefined) baseDir = dirname;
        if (!path.existsSync(dirname)) {
            return;
        }

        if (jadelesscoffee.Compiler.verbose) { console.log('Scanning directory ' + dirname) }
        var files = fs.readdirSync(dirname);
        for (var i = files.length - 1; i >= 0; i--) {
            var filename = path.join(baseDir, '/', files[i]);
            if (jadelesscoffee.Compiler.verbose) { console.log('Found file ' + filename) }
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
                this.compileFile(filename, ScopeLocker.lock(this, function(error, filename) {
                    if (error == null)
                        this.updateCompileHistory(filename, stats.mtime);
                    else
                        console.error(error);
                }));
            } else if (jadelesscoffee.Compiler.verbose) { console.log('Skipping ' + filename) }
        };
    },
    /**
     * Compiles a file based on its extension.
     *
     * @note This will only compile if a compilation is not currently underway. This way if there's a massive save across multiple files, it doesn't force this event over and over again.
     */
    compileFile: function(filename, callback) {
        var extension = path.extname(filename);
        switch(extension) {
            case '.jade':
                if (jadelesscoffee.Compiler.verbose) { console.log(filename + ' compiling as Jade file.') }
                this.buildJadeFile(filename, callback);
                break;
            //less
            case '.less':
                if (jadelesscoffee.Compiler.verbose) { console.log(filename + ' compiling as Less file.') }
                this.buildLessFile(filename, callback);
                break;
            //coffee
            case '.coffee':
                if (jadelesscoffee.Compiler.verbose) { console.log(filename + ' compiling as CoffeeScript file.') }
                this.buildCoffeeFile(filename, callback);
                break;
        };
    },
    updateCompileHistory: function(filename, time) {
        if (filename != '' && time != undefined && time != '')
            this.compileHistory[filename] = time; 
    },
    saveHistory: function() {
        var historyString = '';
        for (var filename in this.compileHistory) {
            historyString += filename + '|' + this.compileHistory[filename] + '\n';
        }

        if (jadelesscoffee.Compiler.verbose) { console.log('Saving compile history to ' + this.sourceDirectory + '/.jlchistory') }

        fs.writeFile(path.join(this.sourceDirectory, '/.jlchistory'), historyString, 'utf8', function(error) {
            if (error && !jadelesscoffee.Compiler.silent)
                console.log(error);
        });
    }
}