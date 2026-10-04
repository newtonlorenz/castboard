import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directories = ['src', 'public', 'plugins', 'screen-types', 'cast-protocols', 'display-adapters', 'scripts', 'test', 'examples', 'services'];

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return ['node_modules','.pio'].includes(entry.name) ? [] : javascriptFiles(entryPath);
    return entry.isFile() && /\.m?js$/.test(entry.name) ? [entryPath] : [];
  });
}

const files = directories.flatMap(directory => javascriptFiles(path.join(root, directory)));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}
const jsonFiles=['package.json','castboard.config.example.json',...fs.readdirSync(path.join(root,'plugins'),{withFileTypes:true}).filter(entry=>entry.isDirectory()&&fs.existsSync(path.join(root,'plugins',entry.name,'plugin.json'))).map(entry=>'plugins/'+entry.name+'/plugin.json')];
for (const directory of ['standard','freenove-fnk0104b','.examples/monochrome']) jsonFiles.push(`display-adapters/${directory}/adapter.json`);
for (const file of jsonFiles) JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const shellScript = path.join(root, 'scripts', 'docker-entrypoint.sh');
const shellResult = spawnSync('sh', ['-n', shellScript], { encoding: 'utf8' });
if (shellResult.status !== 0) {
  process.stderr.write(shellResult.stderr || shellResult.stdout);
  process.exit(shellResult.status || 1);
}
console.log(`Syntax checked ${files.length} JavaScript files, ${jsonFiles.length} JSON files, and the Docker entrypoint.`);
