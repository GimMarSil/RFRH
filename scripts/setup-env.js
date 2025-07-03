const fs = require('fs');
const path = require('path');

const examplePath = path.join(__dirname, '..', '.env.local.example');
const targetPath = path.join(__dirname, '..', '.env.local');

if (fs.existsSync(targetPath)) {
  console.log('.env.local already exists');
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.error('Example env file not found:', examplePath);
  process.exit(1);
}

fs.copyFileSync(examplePath, targetPath);
console.log('Created .env.local from example');

