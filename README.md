JadeLessCoffee
===============

JadeLessCoffee serves a very simple and single purpose: combine three rapid-development languages into one compiler.
The hope in doing this is that the developer can use Jade, Lesscss, and CoffeeScript within whatever framework he or she chooses, 
then compile them down to the more standardized and accepted languages they represent.


IMPORTANT
=========

JadeLessCoffee is *not* meant for a production environment. Not at all. In order to deploy you should always make sure that there aren't any calls to `jlc` in your final product. 

Just to make sure you understand why: **It's slow.**
These tools are meant to make development faster, but with the added benefit of not slowing down the final product in the browser or on the server.

Also of importance: This system hasn't been tested on windows. It *should* work. But... I don't know.


Requirements
------------

**The Node.js platform** At least 0.6.0 (due to some fs methods being used). <http://nodejs.org>
**lesscss** Version 1.3.0 is what this was built with, but older versions will likely compile fine. We only use the `render` method.
**Jade** Version 0.25.0  We only use the `compile` method.
**CoffeeScript** Version 1.3.1 We only use the `compile` method.

Installation
------------

After installing node.js:
`$ sudo npm -g install https://oliverseal@github.com/Nuulogic/jadelesscoffee.git`


Usage
-----

To work on a project that has no dynamic server-side technology (as in no django/rails/logic backend):

- In the project folder make a `src` folder (if you haven't already).
- Write all your jade, less, and coffee files there.
- Make sure they have the .jade, .less, and .coffee extensions appropriately. 
- Either name a folder build or if you already have html files in a folder, serve it through nginx or apache
- Compile the files out to html, css, and js by running `jlc --incremental --output <./build> ./src`
- OR Watch the files so that any time there are changes they are output to the build folder: `jlc --incremental --watch --output <./build> ./src`

Some important notes:
jlc output folder will mimic the src folder structure. So if you have a `src/css/styles.less` file, it will be output to `build/css/styles.css`.
jlc **overwrites** files. If you have an existing file with the same name and folder structure in your output, then jlc will eat it.
jlc creates folders in your output directory. 


Integration
-----------

*To integrate with Django:*

`$ pip install git+https://github.com/Nuulogic/django-jadelesscoffee.git`

Then in your Django application, include this middleware:
`MIDDLEWARE_CLASSES = (
    ...
    'jadelesscoffee.django.middleware.JadeLessCoffeeMiddleware'
)`

Then add a 'src' folder in any of the TEMPLATE_DIRS and STATICFILES_DIRS entries you want to have .jade, .less, or .coffee files in.

The following commands will run at each request and will only compile files that have changed.
`jlc --quiet --incremental --output {{TEMPLATE_DIRS}}/src {{TEMPLATE_DIRS}}`
`jlc --quiet --incremental --output {{STATICFILES_DIRS}}/src {{STATICFILES_DIRS}}`


*To integrate with php-based frameworks:*

Put this into the index.php or any file that is included on every request: `exec("jlc --incremental --output $buildDirectory $sourceDirectory");`


Helpful/Useful
--------------

JadeLessCoffee Sublime Build system (uses a Makefile)
<https://github.com/Nuulogic/JadeLessCoffee-sublime-build>

Jade syntax highlighting
<https://github.com/miksago/jade-tmbundle>

HTML2Jade bin is helpful sometimes too
<https://github.com/donpark/html2jade>


LESS syntax highlighting
<https://github.com/creationix/LESS.tmbundle>


CoffeeScript syntax highlighting
<https://github.com/jashkenas/coffee-script-tmbundle>