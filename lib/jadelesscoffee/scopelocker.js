/**
 * JadeLess Coffee requires delegates for scope locking.
 */
//I blatantly stole this logic from Actionscript 2 concepts WAY BACK IN DA DAY
function ScopeLocker(f) { this.func = f; }
ScopeLocker.prototype.func = function(){}
ScopeLocker.lock = function(obj, func) {
    var f = function() {
        var target = arguments.callee.target;
        var func = arguments.callee.func;
        if(func && target)
            return func.apply(target, arguments);
        return null;
    };

    f.target = obj;
    f.func = func;

    return f;
}

exports['ScopeLocker'] = ScopeLocker;