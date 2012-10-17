jlctest = (if (window.jlctest?) then window.jlctest else {})

#! NOTE: Documentation expected to be generated using [Docco:](http://jashkenas.github.com/docco/)

#### jlctest.Application

# A wrapper for all the functionality.
# There can be only *one* Application instance on a single page, since the url hash is
# queried every half-second to determine the current location.
# 
class jlctest.Application
    # jQuery: Container for the application html container.
    $container = null
    # String: Where the Application thinks it is right now. Matches with values possible in the window.location.hash.
    currentHash = '#home'
    # Number: Interval ID that allows for ``clearInterval()`` to be called if necessary on the hash checker that controls navigation.
    hashCheckIntervalId = 0

    # Contructor
    #
    # Starts the timer to check `window.location.hash` for any changes to determine navigation.
    #
    #### Parameters:
    # * $container jQuery: The container where the background image and section selectors exist as html elements.
    constructor: ($container) ->
        @$container = $container

        @hashCheckIntervalId = setInterval()
        
    onTimerTickCheckForHashChange: ->
        if @currentHash != window.location.hash
            hash = window.location.hash
            # hide the current view and switch to the default view
            if hash == '#home'
                console.log('home')
            else if hash == '#documentation'
                console.log('documentation')
            else
                console.log(hash);
