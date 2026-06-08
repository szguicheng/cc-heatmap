#!/usr/bin/env node
import('../dist/cli.js').then(m => m.main()).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
