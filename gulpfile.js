var gulp = require('gulp'),
    plugins = require('gulp-load-plugins')();

var jsFiles = [
  'src/kramdown.js',
  'src/commands.js'
];

gulp.task('connect', function(){
  return gulp.src(['.', 'docs'])
    .pipe(plugins.webserver({
      port: 8000,
      livereload: true,
      open: true
    }));
});

gulp.task('css', function(){
  return gulp.src('src/*.scss')
    .pipe(plugins.sass())
    .pipe(gulp.dest('docs'));
});

gulp.task('lint', function(){
  return gulp.src(jsFiles)
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter('jshint-stylish'));
});

gulp.task('concat', ['lint'], function(){
  return gulp.src(jsFiles)
    .pipe(plugins.concat('kramdown.js'))
    .pipe(plugins.wrapper({
      header: '(function(global){\n\n' + '\'use strict;\'' + '\n\n',
      footer: '\n\nglobal.Kramdown = Kramdown;\n\n})(this);'
    }))
    .pipe(gulp.dest('docs'));
});


gulp.task('watch', function(){
  gulp.watch('src/kramdown.scss', ['css']);
  gulp.watch(jsFiles, ['concat']);
});

gulp.task('default', ['connect', 'concat', 'css', 'watch']);
// Integrate the build process later;