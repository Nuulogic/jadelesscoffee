var ScopeLocker = require('./scopelocker').ScopeLocker;
var fs = require('fs'),
    path = require('path'),
    jade = require('jade'),
    coffee = require('coffee-script'),
    less = require('less'),
    jadelesscoffee = exports;

jadelesscoffee.Compiler = require('./compiler').Compiler;

jadelesscoffee.Watcher = function(sourceDirectory, outputDirectory, incremental) {
    this.sourceDirectory = sourceDirectory;
    this.outputDirectory = outputDirectory;

    this.compileCounter = 0;

    console.log("Jadeless Coffee running from " + sourceDirectory);

    this.currentlyWatching = [];

    this.compiler = new jadelesscoffee.Compiler(this.sourceDirectory, this.outputDirectory, this.incremental);

    this.onWatchIntervalTickDelegate = ScopeLocker.lock(this, this.onWatchIntervalTick);
    this.onDirectoryReadDelegate = ScopeLocker.lock(this, this.onDirectoryRead);
    this.onFileChangeDelegate = ScopeLocker.lock(this, this.onFileChange);
    this.onJadeFileReadDelegate = ScopeLocker.lock(this, this.onJadeFileRead);

    //interval to read all dirs and detect new files
    setInterval(this.onWatchIntervalTickDelegate, 1000);

    this.currentStatus = "";

    this.readDirectory(this.sourceDirectory);
    this.triggerRecompile();
}

jadelesscoffee.Watcher.prototype = {
    /**
     * Every second this watches for new files. If there are new ones, we add them to the watch list.
     */
    onWatchIntervalTick: function() {
        //read ALL the directories
        this.readDirectory(this.sourceDirectory);
    },
    /**
     *
     */
    readDirectory: function(filePath, baseDir) {
        if (baseDir == undefined) baseDir = filePath;
        var files = fs.readdirSync(filePath);
        for (var i = files.length - 1; i >= 0; i--) {
            var filename = path.join(baseDir, '/', files[i]);
            var stats = fs.statSync(filename);
            //We need to get the data on this file. If it's a directory we want to recurse this on it as well.
            try {
                if (stats.isDirectory()) {
                    this.readDirectory(filename, filename);
                    continue;
                }
            }
            catch(error) {
                continue;
            }

            if (!jadelesscoffee.Compiler.EXTENSIONS_REGEX.test(filename))
                continue;
            if (this.currentlyWatching.indexOf(filename) < 0) {
                fs.watch(filename, this.onFileChangeDelegate);
                this.currentlyWatching.push(filename);
                this.compiler.compileHistory[filename] = stats.mdate;
            }
        };
    },
    /**
     * Triggers a recompile of all *.less, *.coffee, *.jade files.
     *
     * Ideally it would be nice to /only/ recompile necessary files, but fs.watch isn't fully implemented cross platform. On good ole OS X it's terribad right now.
     */
    onFileChange: function(event, filename) {
        if (event == 'change')
            this.triggerRecompile();
    },
    updateStatus: function(newStatus) {
        var backspaces = '';
        for (var i = this.currentStatus.length - 1; i >= 0; i--) {
            backspaces += '\b';
        };
        process.stdout.write(backspaces);
        this.currentStatus = newStatus;
        process.stdout.write(newStatus);
    },
    triggerRecompile: function() {
        this.updateStatus('Compiling code in ' + this.sourceDirectory + ' ' + (new Date()));

        for (var i = this.currentlyWatching.length - 1; i >= 0; i--) {
            var filename = this.currentlyWatching[i];
            this.compiler.compileFile(filename);
        };
    }
}