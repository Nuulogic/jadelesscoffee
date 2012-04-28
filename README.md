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


Requirements
------------

**The Node.js platform** At least 0.6.0 (due to some fs methods being used). <http://nodejs.org>
**lesscss** Version 1.3.0 is what this was built with, but older versions will likely compile fine. We only use the `render` method.
**Jade** Version 0.25.0  We only use the `compile` method.
**CoffeeScript** Version 1.3.1 We only use the `compile` method.

Installation
------------

After installing node.js:
`$ sudo npm -g install git+ssh://git@nuulogic.net:jadelesscoffee.git`


Usage
-----

To work on a project that has no dynamic server-side technology (as in no django/rails/logic backend):

- In the project folder make a `src` folder (if you haven't already).
- Write all your jade, less, and coffee files there.
- Make sure they have the .jade, .less, and .coffee extensions appropriately. 
- Either name a folder build or if you already have html files in a folder, serve it through nginx or apache
- Compile the files out to html, css, and js by running `jlc --incremental --output <./build> ./src`
- OR Watch the files so that any time there are changes they are output to the build folder: `jlc --incremental --watch --output <./build> ./src`

To integrate with django

TODO: Add Django middleware that will do an incremental recompile on HttpRequest. 

To integrate with php-based frameworks
Put this into the index.php or any file that is included on every request: `exec "jlc --incremental --output $buildDirectory $sourceDirectory"`
