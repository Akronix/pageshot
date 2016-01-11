PATH := ./node_modules/.bin:./bin/:$(PATH)
SHELL := /bin/bash
BABEL := babel --retain-lines
JPM := $(shell pwd)/node_modules/.bin/jpm
.DEFAULT_GOAL := help

.PHONY: all clean server addon xpi homepage npm

# This forces bin/_write_ga_id to be run before anything else, which
# writes the configured Google Analytics ID to build/ga-id.txt
_dummy := $(shell ./bin/_write_ga_id)

# Here we have source/dest variables for many files and their destinations;
# we use these each to enumerate categories of source files, and translate
# them into the destination locations.  These destination locations are the
# requirements for the other rules

data_source := $(shell find addon/data -path addon/data/vendor -prune -o -name '*.js')
data_dest := $(data_source:%.js=build/%.js)

vendor_source := $(shell find addon/data/vendor -path addon/data/vendor/readability/test -prune -name addon/data/vendor/readability/test -prune -o -type f)
vendor_dest := $(vendor_source:%=build/%)

# Note shared/ gets copied into two locations (server and addon)
shared_source := $(wildcard shared/*.js)
shared_server_dest := $(shared_source:%.js=build/%.js)
shared_addon_dest := $(shared_source:shared/%.js=build/addon/lib/shared/%.js)

static_addon_source := $(shell find addon -path addon/data/vendor/readability/test -prune -type f -o -name '*.png' -o -name '*.svg' -o -name '*.html')
static_addon_dest := $(static_addon_source:%=build/%)

# static/js only gets copied to the server
static_js_source := $(wildcard static/js/*.js)
static_js_dest := $(static_js_source:%.js=build/server/%.js)

static_vendor_source := $(shell find static/vendor -type f)
static_vendor_dest := $(static_vendor_source:%=build/server/%)

lib_source := $(wildcard addon/lib/*.js)
lib_dest := $(lib_source:%.js=build/%.js)

server_source := $(shell find server/src -name '*.js')
server_dest := $(server_source:server/src/%.js=build/server/%.js)

# Also scss gets put into two locations:
sass_source := $(wildcard static/css/*.scss)
sass_server_dest := $(sass_source:%.scss=build/server/%.css)
sass_addon_dest := $(sass_source:static/css/%.scss=build/addon/data/%.css)

# And static images get placed somewhat eclectically:
imgs_source := $(wildcard static/img/*)
imgs_server_dest := $(imgs_source:%=build/server/%)
imgs_addon_dest := $(imgs_source:static/img/%=build/addon/data/icons/%)

addon_js_source := $(shell find addon -name '*.js')
addon_js_dest := $(addon_js_source:%=build/%)

# These .txt files are generated by browserify --list, and represent
# all the dependencies of the two bundles that are created.  We generated
# the .txt files at the same time we build the bundles themselves.  When
# doing a clean build, these files will not be present, and hopefully the
# bundles will also not be present.  (Possibly we should delete the bundles
# if their dependencies are unknown)
#
# To keep these commands from failing we touch the files just to be sure
# they exist:
shoot_panel_dependencies = $(shell if [[ -e build/shoot-panel-dependencies.txt ]] ; then cat build/shoot-panel-dependencies.txt ; fi)
clientglue_dependencies = $(shell if [[ -e build/clientglue-dependencies.txt ]] ; then cat build/clientglue-dependencies.txt ; fi)
admin_dependencies = $(shell if [[ -e build/admin-dependencies.txt ]] ; then cat build/admin-dependencies.txt ; fi)

## General transforms:
# These cover standard ways of building files given a source

# Need to put these two rules before the later general rule, so that we don't
# run babel on vendor libraries or the homepage libraries:
build/addon/data/vendor/%.js: addon/data/vendor/%.js
	@mkdir -p $(@D)
	cp $< $@

build/server/static/vendor/%: static/vendor/%
	@mkdir -p $(@D)
	cp $< $@

build/server/static/homepage/%.js: static/homepage/%.js
	@mkdir -p $(@D)
	cp $< $@

build/server/static/js/%.js: build/static/js/%.js
	@mkdir -p $(@D)
	cp $< $@

build/%.js: %.js
	@mkdir -p $(@D)
	$(BABEL) $< | bin/_fixup_panel_js > $@

build/server/%.js: server/src/%.js
	@mkdir -p $(@D)
	$(BABEL) $< > $@

build/%.css: %.scss
	@mkdir -p $(@D)
	node-sass $< $@

## Static files to be copied:

build/%.png: %.png
	@mkdir -p $(@D)
	cp $< $@

build/%.css: %.css
	@mkdir -p $(@D)
	cp $< $@

build/%.svg: %.svg
	@mkdir -p $(@D)
	cp $< $@

build/%.sql: %.sql
	@mkdir -p $(@D)
	cp $< $@

build/%.ttf: %.ttf
	@mkdir -p $(@D)
	cp $< $@

build/%.html: %.html
	@mkdir -p $(@D)
	cp $< $@

## Addon related rules:

build/addon/data/panel-bundle.js: $(shoot_panel_dependencies)
	@mkdir -p $(@D)
	# Save the bundle dependencies:
	browserify --list -e ./build/addon/data/shoot-panel.js | sed "s!$(shell pwd)/!!g" > build/shoot-panel-dependencies.txt
	browserify -e ./build/addon/data/shoot-panel.js | ./bin/_fixup_panel_js > $@

# We don't need babel on these specific modules:
build/addon/lib/shared/%.js: build/shared/%.js
	@mkdir -p $(@D)
	cp $< $@

# We copy over files from the server (server rules will generate those
# files from .scss files):
build/addon/data/%.css: build/server/static/css/%.css
	@mkdir -p $(@D)
	cp $< $@

build/addon/data/icons/%: static/img/%
	@mkdir -p $(@D)
	cp $< $@

# FIXME: unsure if this is relevant, given other rules:
build/addon/data/vendor/%: addon/data/vendor/%
	@mkdir -p $(@D)
	cp $< $@

build/mozilla-pageshot.xpi: addon addon/package.json
	# We have to do this each time because we want to set the version using a timestamp:
	_set_package_version < addon/package.json > build/addon/package.json
	# Get rid of any stale xpis:
	rm -f build/addon/jid1-NeEaf3sAHdKHPA@jetpack-*.xpi
	cd build/addon && $(JPM) xpi
	mv build/addon/jid1-NeEaf3sAHdKHPA@jetpack-*.xpi build/mozilla-pageshot.xpi

build/mozilla-pageshot.update.rdf: addon/template.update.rdf build/mozilla-pageshot.xpi
	_sub_rdf_checkout_version < build/addon/package.json > build/mozilla-pageshot.update.rdf

# FIXME: not sure what purpose this has, given _set_package_version
build/addon/package.json: addon/package.json
	@mkdir -p $(@D)
	cp $< $@

build/addon/lib/httpd.jsm: addon/lib/httpd.jsm
	@mkdir -p $(@D)
	cp $< $@

addon: npm $(data_dest) $(vendor_dest) $(lib_dest) $(sass_addon_dest) $(imgs_addon_dest) $(static_addon_dest) $(shared_addon_dest) build/addon/data/panel-bundle.js build/addon/package.json build/addon/lib/httpd.jsm

xpi: build/mozilla-pageshot.xpi build/mozilla-pageshot.update.rdf

## Server related rules:

# Copy shared files in from static/:
build/server/static/css/%.css: build/static/css/%.css
	@mkdir -p $(@D)
	cp $< $@

build/server/static/img/%: build/static/img/%
	@mkdir -p $(@D)
	cp $< $@

build/server/static/js/server-bundle.js: $(clientglue_dependencies)
	@mkdir -p $(@D)
	# Generate/save dependency list:
	browserify --list -e ./build/server/clientglue.js | sed "s!$(shell pwd)/!!g" | grep -v build-time > build/clientglue-dependencies.txt
	browserify -o $@ -e ./build/server/clientglue.js ./build/server/shotindexglue.js

build/server/static/js/admin-bundle.js: $(admin_dependencies) $(server_dest)
	@mkdir -p $(@D)
	# Generate/save dependency list:
	browserify --list -e ./build/server/pages/admin/controller.js | sed "s!$(shell pwd)/!!g" | grep -v build-time > build/admin-dependencies.txt
	browserify -o $@ -e ./build/server/pages/admin/controller.js

build/server/export-shots.sh: server/src/export-shots.sh
	@mkdir -p $(@D)
	cp -p $< $@

# The intention here is to only write build-time when something else needs
# to be regenerated, but for some reason this gets rewritten every time
# anyway:
build/server/build-time.js: homepage $(server_dest) $(shared_server_dest) $(sass_server_dest) $(imgs_server_dest) $(static_js_dest) $(static_vendor_dest) build/server/export-shots.sh $(patsubst server/db-patches/%,build/server/db-patches/%,$(wildcard server/db-patches/*))
	@mkdir -p $(@D)
	./bin/_write_build_time > build/server/build-time.js

server: npm build/server/build-time.js build/server/static/js/server-bundle.js build/server/static/js/admin-bundle.js

## Homepage related rules:

# The only non-static file, we substitute the Google Analytics ID in here:
build/server/static/homepage/index.html: static/homepage/index.html build/ga-id.txt
	mkdir -p $(@D)
	sed "s/GA_ID/$(shell cat build/ga-id.txt)/g" < $< > $@

build/server/static/homepage/%: static/homepage/%
	@mkdir -p $(@D)
	cp $< $@

homepage: build/server/static/homepage/index.html $(patsubst static/homepage/%,build/server/static/homepage/%,$(shell find static/homepage -type f ! -name index.html))

## npm rule

npm: build/.npm-install.log

build/.npm-install.log: package.json
	# Essentially .npm-install.log is just a timestamp showing the last time we ran
	# the command
	npm install > build/.npm-install.log

# This causes intermediate files to be kept (e.g., files in static/ which are copied to the addon and server but aren't used/required directly):
.SECONDARY:

all: addon server

clean:
	rm -rf build/

help:
	@echo "Makes the addon and server"
	@echo "Commands:"
	@echo "  make addon"
	@echo "    make the addon (everything necessary for the xpi)"
	@echo "  make xpi"
	@echo "    make build/mozilla-pageshot.xpi"
	@echo "  make server"
	@echo "    make the server in build/server/"
	@echo "  make all"
	@echo "    equivalent to make server addon"
	@echo "See also:"
	@echo "  bin/run-addon"
	@echo "  bin/run-server"
