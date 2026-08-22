#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'castboard.config.example.json');
const destination = path.join(root, 'castboard.config.json');

try {
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  console.log('Created castboard.config.json from the starter configuration.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Kept existing castboard.config.json unchanged.');
}

console.log('Next: npm start');
console.log('Then open http://localhost:8787/setup');
