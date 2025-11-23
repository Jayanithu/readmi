import fs from 'fs/promises';
import { join } from 'path';
import path from 'path';

export async function getAllFiles(dir, fileList = []) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vscode', '.idea'];
  const ignoreFiles = ['.DS_Store', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
  
  for (const file of files) {
    const filePath = join(dir, file.name);
    
    if (file.isDirectory() && !ignoreDirs.includes(file.name) && !file.name.startsWith('.')) {
      await getAllFiles(filePath, fileList);
    } else if (file.isFile() && !ignoreFiles.includes(file.name)) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

export async function readSourceFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.substring(0, 5000);
  } catch {
    return null;
  }
}

export async function extractProjectName(dir, packageJson) {
  if (packageJson.name) {
    return packageJson.name.replace(/^@[^/]+\//, '').replace(/[-_]/g, ' ');
  }
  
  const dirName = dir.split(path.sep).pop();
  if (dirName && dirName !== '') {
    return dirName.replace(/[-_]/g, ' ');
  }
  
  return 'Project';
}

export async function extractFeaturesFromCode(sourceFiles) {
  const keywords = new Set();
  
  for (const filePath of sourceFiles.slice(0, 15)) {
    const content = await readSourceFile(filePath);
    if (!content) continue;
    
    if (content.includes('API') || content.includes('api')) keywords.add('API');
    if (content.includes('CLI') || content.includes('command')) keywords.add('CLI');
    if (content.includes('database') || content.includes('db')) keywords.add('Database');
    if (content.includes('authentication') || content.includes('auth')) keywords.add('Authentication');
    if (content.includes('middleware')) keywords.add('Middleware');
    if (content.includes('router') || content.includes('route')) keywords.add('Routing');
    if (content.includes('component')) keywords.add('Components');
    if (content.includes('hook')) keywords.add('Hooks');
    if (content.includes('util') || content.includes('helper')) keywords.add('Utilities');
  }
  
  return Array.from(keywords);
}

export async function analyzeProject(dir) {
  const info = {
    name: '',
    displayName: '',
    description: '',
    version: '',
    dependencies: {},
    devDependencies: {},
    scripts: {},
    files: [],
    sourceCode: {},
    hasTests: false,
    hasDocker: false,
    hasGithubActions: false,
    envVars: [],
    mainFile: '',
    sourceFiles: [],
    hasEnvFile: false,
    repository: '',
    homepage: '',
    bugs: '',
    author: '',
    keywords: [],
    detectedFeatures: [],
    projectStructure: {},
    entryPoints: []
  };
  
  try {
    let packageJson = {};
    try {
      packageJson = JSON.parse(await fs.readFile(join(dir, 'package.json'), 'utf8'));
      Object.assign(info, packageJson);
    } catch {}
    
    info.name = packageJson.name || '';
    info.displayName = await extractProjectName(dir, packageJson);
    
    const allFiles = await getAllFiles(dir);
    info.files = allFiles.map(f => f.replace(dir + path.sep, ''));
    
    const sourceExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.rb', '.php', '.cpp', '.c', '.cs'];
    const sourceFilePaths = allFiles.filter(f => 
      sourceExtensions.some(ext => f.endsWith(ext)) &&
      !f.includes('node_modules') &&
      !f.includes('.git') &&
      !f.includes('test') &&
      !f.includes('spec')
    );
    
    info.sourceFiles = sourceFilePaths.map(f => f.replace(dir + path.sep, ''));
    
    const keyFiles = [
      info.main || info.mainFile,
      ...Object.values(packageJson.bin || {}),
      'index.js', 'index.ts', 'app.js', 'app.ts', 'main.js', 'main.ts',
      'src/index.js', 'src/index.ts', 'src/app.js', 'src/app.ts'
    ].filter(Boolean).slice(0, 5);
    
    for (const keyFile of keyFiles) {
      const filePath = join(dir, keyFile);
      try {
        const content = await readSourceFile(filePath);
        if (content) {
          info.sourceCode[keyFile] = content;
        }
      } catch {}
    }
    
    for (const sourceFile of sourceFilePaths.slice(0, 10)) {
      if (!info.sourceCode[sourceFile.replace(dir + path.sep, '')]) {
        const content = await readSourceFile(sourceFile);
        if (content) {
          const relativePath = sourceFile.replace(dir + path.sep, '');
          info.sourceCode[relativePath] = content;
        }
      }
    }
    
    info.detectedFeatures = await extractFeaturesFromCode(sourceFilePaths);
    
    if (info.main) info.entryPoints.push(info.main);
    if (info.bin) {
      info.entryPoints.push(...Object.values(info.bin));
    }
    
    info.hasTests = allFiles.some(f => 
      f.includes('test') || 
      f.includes('spec') || 
      f.includes('__tests__') ||
      f.includes('.test.') ||
      f.includes('.spec.')
    );
    
    info.hasDocker = allFiles.some(f => 
      f.endsWith('Dockerfile') || 
      f.endsWith('docker-compose.yml') ||
      f.endsWith('docker-compose.yaml')
    );
    
    try {
      const githubDir = join(dir, '.github', 'workflows');
      const workflows = await fs.readdir(githubDir);
      info.hasGithubActions = workflows.length > 0;
    } catch {
      info.hasGithubActions = false;
    }
    
    info.hasEnvFile = allFiles.some(f => f.includes('.env'));
    
    try {
      const envExample = await fs.readFile(join(dir, '.env.example'), 'utf8');
      info.envVars = envExample
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#') && line.includes('='))
        .map(line => line.split('=')[0].trim());
    } catch {
      try {
        const envFile = await fs.readFile(join(dir, '.env'), 'utf8');
        info.envVars = envFile
          .split('\n')
          .filter(line => line.trim() && !line.startsWith('#') && line.includes('='))
          .map(line => line.split('=')[0].trim());
      } catch {
        info.envVars = [];
      }
    }
    
    const dirs = new Set();
    for (const file of info.files) {
      const parts = file.split(path.sep);
      if (parts.length > 1) {
        dirs.add(parts[0]);
      }
    }
    info.projectStructure = {
      directories: Array.from(dirs).slice(0, 10),
      totalFiles: info.files.length,
      sourceFiles: info.sourceFiles.length
    };
    
    return info;
  } catch (error) {
    return info;
  }
}

