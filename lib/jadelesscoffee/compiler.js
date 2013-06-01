var ScopeLocker = require('./scopelocker').ScopeLocker;
var fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    jade = require('jade'),
    coffee = require('coffee-script'),
    less = require('less');

if (fs.existsSync != undefined) path.existsSync = fs.existsSync;
    

//borrowed from less. Some of this is needless for the compiler, but in here in case we get there later
if (typeof environment === 'object' && ({}).toString.call(environment) === '[object Environment]') {
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

jadelesscoffee.Compiler = function(sourceDirectory, outputDirectory, incremental, options) {
	if (!this.rootSourceDirectory) this.rootSourceDirectory = sourceDirectory;
    this.sourceDirectory = path.join(path.dirname(sourceDirectory), '/', path.basename(sourceDirectory));
    this.outputDirectory = path.join(path.dirname(outputDirectory), '/', path.basename(outputDirectory));
    
    this.incremental = (incremental == true);
    // this.incremental = false;

    this.compileCount = 0;

    this.options = options || {html: false, ugly: false};

    this.htmlErrorTemplate = null;
    this.htmlErrorCallback = null;

    this.compileHistory = {};
    //if incremental load up the .jlchistory
    try {
        var history = fs.readFileSync(path.join(this.sourceDirectory, '/.jlchistory'), 'utf8');
        var historyLines = history.split('\n');
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
jadelesscoffee.Compiler.ugly = false
jadelesscoffee.Compiler.maps = true;
jadelesscoffee.Compiler.prototype = {
    /**
     *
     */
    buildJadeFile: function(filename, callback) {
        if (filename) {
            //read in the jade file
            var data = fs.readFileSync(filename, 'utf8');

            try {
                var jadeCompiler = jade.compile(data, {pretty: !this.options.ugly, filename: filename});
                var jadeHtml = jadeCompiler({DEBUG: true, COMPILE_TIME: new Date()});
            } catch(err) {
                if (callback)
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
            if (callback)
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
                pretty: !jadelesscoffee.Compiler.ugly, 
                compress: jadelesscoffee.Compiler.ugly,
                yuicompress: false,
                optimization: 1,
                silent: false,
                color: true,
                filename: filename,
                paths: [path.dirname(filename)],
                strictImports: false };
            if (jadelesscoffee.Compiler.maps && !jadelesscoffee.Compiler.ugly) 
            	options.dumpLineNumbers = 'comments';
            try {
                less.render(data, options, ScopeLocker.lock(this, function(e, css) {
                    if (e && callback) {
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
                    if (callback)
                        callback(null, filename);
                }));
            }
            catch (err) {
                if (typeof(err) == 'object') {
                    var message = 'Syntax Error in ' + filename;
                    if (err.line)
                        message += ' at line ' + err.line;
                    if (err.column)
                        message += ',' + err.column + ':\t';
                    if (err.message)
                        message += err.message + '\n';
                    if (err.extract)
                        message += err.extract.join('\n');
                    if (callback)
                        callback(message, filename);
                    else
                        console.log(message);
                } else if (callback)
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
            var pathToSourceMapFile = filename.replace(this.sourceDirectory, this.outputDirectory).replace(/\.coffee$/, '.js.map');
            var pathToBuildFile = filename.replace(this.sourceDirectory, this.outputDirectory).replace(/\.coffee$/, '.js');

            try {
                var coffeeJs = coffee.compile(data, {
                	pretty: !jadelesscoffee.Compiler.ugly, 
                	filename: pathToSourceMapFile, 
                	sourceMap: jadelesscoffee.Compiler.maps != false, 
                	generatedFile: path.basename(pathToBuildFile), 
                	sourceFiles: [path.basename(filename)], 
                	sourceRoot: '../' + (path.basename(this.rootSourceDirectory) + filename.replace(path.basename(filename), '').replace(this.rootSourceDirectory, '')).replace(/\\/g, '/')
                });
            }
            catch(err) {
                if (callback)
                    callback(err, filename);
                return;
            }

            //write to the output directory
            //make sure the path exists
            if (!path.existsSync(path.dirname(pathToBuildFile)))
                mkdirp(path.dirname(pathToBuildFile), 0755);

            if (jadelesscoffee.Compiler.verbose) { console.log(filename + ' finished CoffeeScript compile; Writing to ' + pathToBuildFile) }

            if (coffeeJs.js) {
            	var header = '';
	            if (coffeeJs.sourceMap) {
		        	header = '//@ sourceMappingURL=' + path.basename(pathToSourceMapFile) + '\n';
		        	//header += '//@ sourceURL=' + path.basename(filename) + '\r\n';
		            if (jadelesscoffee.Compiler.verbose) { console.log('Writing source map to ' + pathToSourceMapFile) };
		            fs.writeFile(pathToSourceMapFile, coffeeJs.v3SourceMap);
		            fs.writeFile(pathToBuildFile, header);
		    	}
	            fs.writeFile(pathToBuildFile, header + coffeeJs.js.toString());
	        } else {
	        	fs.writeFile(pathToBuildFile, coffeeJs);
	        }
            this.compileCount++;
            if (callback)
                callback(null, filename);
        }
    },
    /**
     * Compiles all files in a directory and its subdirectories and outputs them to the destination directory
     */ 
    compile: function(dirname, baseDir, htmlErrorCallback) {
        if (dirname == undefined) dirname = this.sourceDirectory;
        if (baseDir == undefined) baseDir = dirname;
        this.htmlErrorCallback = htmlErrorCallback;
        if (!path.existsSync(dirname)) {
            if (!jadelesscoffee.Compiler.silent) console.log('Path ' + dirname + ' does not exist.');
            return;
        }

        if (this.incremental && !jadelesscoffee.Compiler.silent) {console.log('Incremental compile started...');}

        this.subCompile(dirname, baseDir, htmlErrorCallback);
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
                        if (this.options.html) {
                            var fileType = path.extname(filename).substr(1);
                            if (this.htmlErrorCallback) {
                                //gotta get it in scope for the callback function below
                                htmlErrorCallback = this.htmlErrorCallback;
                                this.generateHtmlErrorMessage(error, filename, fileType, function(filename, fileType, errorMessage) {
                                    htmlErrorCallback(filename, fileType, errorMessage);
                                });
                            }
                        }
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
    },
    getHtmlErrorTemplate: function() {
        if (this.htmlErrorTemplate == null)
            this.htmlErrorTemplate = fs.readFileSync(__dirname + '/htmlerrors/default.html', 'UTF-8');

        return this.htmlErrorTemplate;
    },
    /**
     * Returns html with information on where to find the error.
     *
     * Since every compiler returns a different style of errorObject, type is used to determine how to parse the errorObject.
     */
    generateHtmlErrorMessage: function(errorObject, filename, type, templateCompleteCallback) {
        var template = this.getHtmlErrorTemplate();

        //replace the filename
        template = template.replace(/\{\{filename\}\}/g, filename);
        template = template.replace(/\{\{type\}\}/g, type);
        //console.log('HTML ERROR  for ' + type);
        //console.log(errorObject);

        var util = require('util');

        if (type == 'coffee') {
            var errorMessage = errorObject.toString();

            template = template.replace(/\{\{error\}\}/g, errorMessage);
            //parse the errorObject string
            //if it's a parser error:
            var lineNumber = errorMessage.match(/on line (\d+)/);
            if (lineNumber && lineNumber.length > 0) {
                lineNumber = Number(lineNumber[1]);

                if (lineNumber > 3) {
                    var startLineNumber = lineNumber - 3;
                    var endLineNumber = lineNumber + 3;
                }
                var code = '';
                var lines = this.getLinesFromFileSync(filename, startLineNumber, endLineNumber);

                //got the lines
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    var iLineNumber = (startLineNumber+i);
                    if (iLineNumber == lineNumber)
                        code += '<em>'+ iLineNumber + line + '</em>';
                    else
                        code += iLineNumber.toString() + line + '';
                };

                template = template.replace(/\{\{code\}\}/g, code);

                //too slow asynchronously, so deprecated.
                /*var lines = [];
                this.getLinesFromFile(filename, startLineNumber, endLineNumber, function(returnedLines) {
                    lines = returnedLines;

                    //got the lines
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i];
                        if (i == lineNumber)
                            code += '<em>' + line + '</em><br />';
                        else
                            code += line + '<br />';
                    };

                    template = template.replace(/\{\{code\}\}/g, code);

                    if (templateCompleteCallback) {
                        templateCompleteCallback(filename, type, template)
                    }
                });*/
            }
            //can't get line numbers
            else {

            }            

            if (templateCompleteCallback) {
                templateCompleteCallback(filename, type, template)
            }
        }

        if (type == 'less') {
            var errorMessage = errorObject.toString();

            var errorMessageLines = errorMessage.split('\n');
            var actualErrorMessage = errorMessageLines[0];

            template = template.replace(/\{\{error\}\}/g, actualErrorMessage);
            //parse the errorObject string
            var lineNumber = errorMessage.match(/(?:.*?)at line (\d+)(?:.*)/m);
            var startLineNumber = 0;
            var endLineNumber = 6;
            if (lineNumber && lineNumber.length > 0) {
                lineNumber = Number(lineNumber[1]);
                //if it's a parser error:
                if (lineNumber > 3) {
                    startLineNumber = lineNumber - 3;
                    endLineNumber = lineNumber + 3;
                }


                var code = '';
                var lines = this.getLinesFromFileSync(filename, startLineNumber, endLineNumber);

                //got the lines
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    var iLineNumber = (startLineNumber+i);
                    if (iLineNumber == lineNumber)
                        code += '<em>'+ iLineNumber + line + '</em>';
                    else
                        code += iLineNumber.toString() + line + '';
                };

                template = template.replace(/\{\{code\}\}/g, code);
            }

            if (templateCompleteCallback) {
                templateCompleteCallback(filename, type, template)
            }
        }

        if (type == 'jade') {
            var errorMessage = errorObject.toString();

            var errorMessageLines = errorMessage.split('\n');
            var actualErrorMessage = errorMessageLines[errorMessageLines.length - 1];

            template = template.replace(/\{\{error\}\}/g, actualErrorMessage);
            //parse the errorObject string
            var lineNumber = errorMessage.match(/(?:.*?)ReferenceError: (?:.+?):(\d+)(?:.*)/m);
            var startLineNumber = 0;
            var endLineNumber = 6;
            if (lineNumber && lineNumber.length > 0) {
                lineNumber = Number(lineNumber[1]);
                //if it's a parser error:
                if (lineNumber > 3) {
                    startLineNumber = lineNumber - 3;
                    endLineNumber = lineNumber + 3;
                }

            }

            var code = '';
            var lineRegex = /^\s*(\> |)(\d+)\|(.*?)$/gm;
            var line = lineRegex.exec(errorMessage); 
            //got the lines
            var i = 0;
            while (line = lineRegex.exec(errorMessage)) {
                var iLineNumber = (startLineNumber+i);
                if (iLineNumber == lineNumber)
                    code += '<em>'+ iLineNumber + line[3] + '</em>\n';
                else
                    code += iLineNumber.toString() + line[3] + '\n';
                i++;
            }

            template = template.replace(/\{\{code\}\}/g, code);

            if (templateCompleteCallback) {
                templateCompleteCallback(filename, type, template)
            }
        }
    },
    getLinesFromFileSync: function(filename, startLineNumber, endLineNumber) {
        var theWholeFile = fs.readFileSync(filename, 'utf-8');
        var allTheLines = theWholeFile.split('\n');

        if (startLineNumber < 1)
            startLineNumber = 1;
        if (endLineNumber > allTheLines.length)
            endLineNumber = allTheLines.length;

        return allTheLines.slice(startLineNumber-1, endLineNumber-1);
    },
    getLinesFromFile: function(filename, startLineNumber, endLineNumber, callback) {
        var stream = fs.createReadStream(filename, {
          flags: 'r',
          encoding: 'utf-8',
          fd: null,
          mode: 0666,
          bufferSize: 64 * 1024
        });

        var fileData = '';
        var returnableLines = [];

        stream.on('data', function(data){
            fileData += data;

            // The next lines should be improved
            var lines = fileData.split("\n");

            if(lines.length >= +endLineNumber) {
                stream.destroy();

                for (var i = startLineNumber; i <= endLineNumber; i++) {
                    if (lines.length >= i && i > 0) {
                        returnableLines.push(i + ' ' + lines[i]);
                    }
                };

                callback(returnableLines);
            }
        });

        stream.on('error', function(){
            callback(['Error reading file.']);
        });

        stream.on('end', function(){
            callback([]);
        });

    }
}