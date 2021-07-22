'use babel';

const fs = require('fs')
const solc = require('solc')
const path = require('path')

const rawFilePath = process.argv[2];

const dirPath = path.dirname(rawFilePath)
const filePath = path.basename(rawFilePath)
const input = {language: 'Solidity', sources: {}};
const content = {};
content['content'] = fs.readFileSync(rawFilePath, 'utf8');
input.sources[filePath] = content;

function parseErrors(dirPath, errors) {
  return errors
    .filter(err => err.sourceLocation)
    .map(err => {
      const filePath = path.resolve(dirPath, err.sourceLocation.file);
      const raw_error_location = err.formattedMessage.match(/\:\d+:\d+\:/);
      var line, start, end, textStart;
      if (raw_error_location !== null) {
        raw_error_range = raw_error_location[0].split(':').slice(1,3);
        line = parseInt(raw_error_range[0])-1;

        const raw_error_range_segment = err.formattedMessage.split('\n')[4];

        textStart = raw_error_range_segment.indexOf('|') + 1;
        start = raw_error_range_segment.indexOf('^') - textStart - 1;
        end = raw_error_range_segment.lastIndexOf('^') - textStart;
      } else {
        line = start = end = 0;
      }

      const text = err.message;

      return {text, filePath, range: [[line, start], [line, end]], type: err.severity};
    });
}

function tryReaddirSync(fp) {
  try {
    return fs.readdirSync(fp);
  } catch(err) {}
  return [];
}

function findDirectory(dirName, cwd) {
  var dir = '';
  while(dir !== cwd) {
    dir = cwd;
    var dirs = tryReaddirSync(dir);
    if(dirs.indexOf(dirName) !== -1) {
      return path.resolve(cwd, dirs[dirs.indexOf(dirName)]);
    }
    cwd = path.dirname(cwd);
  }
  return '';
}

function findImports(dirPath) {
  return function(file) {
    try {
      var filePath = path.resolve(dirPath, file);
      // If file doesn't exist try in project node modules
      if(!fs.existsSync(filePath)) {
        filePath = path.resolve(
          findDirectory('node_modules', dirPath),
          file
         );
      }
      // If file doesn't exist try in ethPM contracts
      if(!fs.existsSync(filePath)) {
        filePath = path.resolve(
          findDirectory('installed_contracts', dirPath),
          file
        );
      }
      return {contents: fs.readFileSync(filePath, 'utf8')}
    } catch(err) {
      return {error: err}
    }
  }
}


const output = solc.compile(JSON.stringify(input), {import: findImports(dirPath)})
const parsed = JSON.parse(output);
const errors = parsed.errors ? parseErrors(dirPath, parsed.errors): [];

process.stdout.write(JSON.stringify(errors), 'utf8');
process.exit();
