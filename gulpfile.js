var gulp = require('gulp'),
    plugins = require('gulp-load-plugins')();

var jsFiles = [
  'src/commands.js',
  'src/kramdown.js'
];

gulp.task('css', function(){
  return gulp.src('src/kramdown.scss')
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
      header: '(function(){\n',
      footer: '\n})();'
    }))
    .pipe(gulp.dest('docs'));
});


gulp.task('watch', function(){
  gulp.watch('src/kramdown.scss', ['css']);
  gulp.watch(jsFiles, ['lint'])
});

gulp.task('default', ['concat', 'css', 'watch']);
// Integrate the build process later;