"use strict";

const gulp = require('gulp'),
	babel = require('@babel/core'),
    beautify = require('gulp-beautify'),
    through = require('through2'),
    fs = require('fs'),
    clean = require('gulp-clean');

gulp.task("cleanup", function() {
	return gulp.src('./dist', {allowEmpty: true})
       .pipe(clean());
});

gulp.task("build", function() {
	return gulp.src("./src/**")
		.pipe(transpiler())
		.pipe(gulp.dest("./dist/lib"));
});

gulp.task("add-mysql", function() {
    return gulp.src([
        "../mysql/dist/**",
        "!../mysql/dist/node_modules"
        ])
        .pipe(gulp.dest("./dist/mysql"));
});

gulp.task("add-gql", function() {
    return gulp.src([
        "../gql-server/dist/**",
        "!../gql-server/dist/node_modules"
        ])
        .pipe(gulp.dest("./dist/gql-server"));
});

gulp.task("create-package", function() {
	const json = require('./package');

    json.dependencies["@wrapper/mysql"] = "file:./mysql";
    json.dependencies["@wrapper/gql-server"] = "file:./gql-server";

    delete json.devDependencies;
    delete json.scripts;

    fs.writeFileSync( './dist/package.json', JSON.stringify(json));

    return gulp.src('./dist/package.json')
            .pipe(beautify({index_size: 2}))
            .pipe(gulp.dest('./dist'));
});

gulp.task("bundle", function(done) {
	gulp.series("cleanup", "build", "add-mysql", "add-gql", "create-package")();

	return done();
});

function transpiler() {
    return through.obj(function(file, enc, cb) {
        if (!file.isBuffer()) {
            return cb();
        }

        const content = babel.transform(file.contents.toString());
        file.contents = Buffer.from(content.code);
        file.path = file.path.replace('.jsx', '.js');

        cb(null, file);
    });
}