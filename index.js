#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import Conf from 'conf';
import { validateApiKey, validateProjectStructure } from './utils/validation.js';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize configuration
const config = new Conf({
  projectName: 'readmi',
  defaults: {
    apiKey: null,
    defaultLicense: 'MIT',
    customPrompts: {},
    outputFormat: 'markdown'
  }
});

// Project types configuration
const PROJECT_TYPES = {
  nodejs: {
    files: ['package.json'],
    parser: 'parseNodeProject'
  },
  python: {
    files: ['requirements.txt', 'setup.py'],
    parser: 'parsePythonProject'
  },
  java: {
    files: ['pom.xml', 'build.gradle'],
    parser: 'parseJavaProject'
  },
  rust: {
    files: ['Cargo.toml'],
    parser: 'parseRustProject'
  },
  go: {
    files: ['go.mod'],
    parser: 'parseGoProject'
  }
};

class ReadmeGenerator {
  constructor() {
    this.currentDir = process.cwd();
    this.projectInfo = {
      type: 'unknown',
      files: [],
      dependencies: {},
      mainFile: null
    };
  }

  async init() {
    try {
      console.log(chalk.blue('📝 README Generator Starting...'));
      const apiKey = await this.getApiKey();
      await this.analyzeProject();
      await this.generateReadme(apiKey);
    } catch (error) {
      this.handleError(error);
    }
  }

  async getApiKey() {
    // Check if API key exists in config
    const savedApiKey = config.get('apiKey');
    
    if (savedApiKey) {
      console.log(chalk.green('✓ Using saved API key'));
      return savedApiKey;
    }

    const { apiKey, saveKey } = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: chalk.yellow('Enter your Google AI API Key:'),
        validate: input => {
          try {
            return validateApiKey(input);
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'confirm',
        name: 'saveKey',
        message: 'Would you like to save this API key for future use?',
        default: true
      }
    ]);

    if (saveKey) {
      config.set('apiKey', apiKey);
      console.log(chalk.green('✓ API key saved for future use'));
    }

    return apiKey;
  }

  async analyzeProject() {
    console.log(chalk.blue('\n🔍 Analyzing project structure...'));
    
    const files = await fs.readdir(this.currentDir);
    
    // Detect project type
    for (const [type, config] of Object.entries(PROJECT_TYPES)) {
      if (config.files.some(file => files.includes(file))) {
        this.projectInfo.type = type;
        await this[config.parser](files);
        break;
      }
    }

    this.projectInfo.files = await this.getSourceFiles();
    validateProjectStructure(this.projectInfo);
  }

  async generateReadme(apiKey) {
    console.log(chalk.blue('\n🤖 Generating README content...'));
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      // Get package.json content if exists
      let packageInfo = {};
      try {
        const packageJson = await fs.readFile(join(this.currentDir, 'package.json'), 'utf8');
        packageInfo = JSON.parse(packageJson);
      } catch {}

      // Enhanced project analysis
      const projectDetails = {
        ...this.projectInfo,
        gitInfo: await this.getGitInfo(),
        dependencies: await this.getAllDependencies(),
        structure: await this.getProjectStructure(),
        mainLanguage: await this.detectMainLanguage(),
        packageManagers: await this.detectPackageManagers(),
        name: packageInfo.name || path.basename(this.currentDir),
        version: packageInfo.version,
        description: packageInfo.description,
        scripts: packageInfo.scripts
      };

      const prompt = `Create a detailed README.md for a ${projectDetails.type} project named "${projectDetails.name}".

Project Analysis:
- Name: ${projectDetails.name}
${projectDetails.version ? `- Version: ${projectDetails.version}` : ''}
${projectDetails.description ? `- Description: ${projectDetails.description}` : ''}
- Main Language: ${projectDetails.mainLanguage}
- Package Managers: ${projectDetails.packageManagers.join(', ')}
- Dependencies: ${JSON.stringify(projectDetails.dependencies, null, 2)}
- Available Scripts: ${JSON.stringify(projectDetails.scripts, null, 2)}
- Project Structure:
${projectDetails.structure}
${projectDetails.gitInfo ? `- Git Repository: ${JSON.stringify(projectDetails.gitInfo, null, 2)}` : ''}

Requirements:
1. Start with a clear, concise project title and description
2. Include all available installation methods using detected package managers
3. List all setup steps in order
4. Provide specific usage examples based on available scripts
5. Document all dependencies with their purposes
6. Include development setup instructions
7. Add contributing guidelines if git repository exists
8. Include license information
9. Add badges for: version, license, main language
10. Use proper markdown formatting with:
    - Code blocks with correct language tags
    - Clear section headers with emojis
    - Tables for structured data
    - Links to important resources

Make the README professional, clear, and specific to this project's actual structure and purpose.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Post-process the content
      const processedContent = this.postProcessReadme(text, projectDetails);
      
      await fs.writeFile(join(this.currentDir, 'README.md'), processedContent);
      console.log(chalk.green('\n✨ README.md generated successfully!'));
    } catch (error) {
      throw new Error(`README generation failed: ${error.message}`);
    }
  }

  postProcessReadme(content, projectDetails) {
    // Add badges
    const badges = [];
    if (projectDetails.version) {
      badges.push(`![Version](https://img.shields.io/badge/version-${projectDetails.version}-blue.svg)`);
    }
    badges.push(`![Language](https://img.shields.io/badge/language-${projectDetails.mainLanguage}-green.svg)`);
    badges.push('![License](https://img.shields.io/badge/license-MIT-orange.svg)');

    // Add badges at the top
    if (badges.length > 0) {
      content = badges.join(' ') + '\n\n' + content;
    }

    return content;
  }

  async getGitInfo() {
    try {
      const { execSync } = await import('child_process');
      const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      return { remoteUrl, branch };
    } catch {
      return null;
    }
  }

  async getAllDependencies() {
    const dependencies = {};
    
    // Check for package.json
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      dependencies.npm = { ...packageJson.dependencies, ...packageJson.devDependencies };
    } catch {}

    // Check for requirements.txt
    try {
      const requirements = await fs.readFile('requirements.txt', 'utf8');
      dependencies.python = requirements.split('\n').filter(line => line.trim());
    } catch {}

    // Check for composer.json
    try {
      const composerJson = JSON.parse(await fs.readFile('composer.json', 'utf8'));
      dependencies.php = { ...composerJson.require, ...composerJson['require-dev'] };
    } catch {}

    // Add more package manager checks as needed
    return dependencies;
  }

  async getProjectStructure() {
    const structure = [];
    const ignoredDirs = ['node_modules', 'venv', '.git', 'dist', 'build'];
    
    async function scanDir(dir, depth = 0) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (ignoredDirs.includes(entry.name)) continue;
        
        if (entry.isDirectory()) {
          structure.push(`${'  '.repeat(depth)}📁 ${entry.name}/`);
          await scanDir(join(dir, entry.name), depth + 1);
        } else {
          structure.push(`${'  '.repeat(depth)}📄 ${entry.name}`);
        }
      }
    }
    
    await scanDir(this.currentDir);
    return structure.join('\n');
  }

  async detectMainLanguage() {
    const extensions = {};
    
    async function countFiles(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await countFiles(join(dir, entry.name));
        } else {
          const ext = entry.name.split('.').pop();
          if (ext) extensions[ext] = (extensions[ext] || 0) + 1;
        }
      }
    }
    
    await countFiles(this.currentDir);
    const mainExt = Object.entries(extensions)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
      
    const langMap = {
      js: 'JavaScript', py: 'Python', java: 'Java',
      rb: 'Ruby', php: 'PHP', go: 'Go',
      rs: 'Rust', cs: 'C#', cpp: 'C++'
    };
    
    return langMap[mainExt] || 'Unknown';
  }

  async detectPackageManagers() {
    const managers = [];
    const files = await fs.readdir(this.currentDir);
    
    const packageFiles = {
      'package.json': 'npm/yarn',
      'requirements.txt': 'pip',
      'composer.json': 'composer',
      'Gemfile': 'bundler',
      'go.mod': 'go modules',
      'pom.xml': 'maven',
      'build.gradle': 'gradle',
      'Cargo.toml': 'cargo'
    };
    
    for (const [file, manager] of Object.entries(packageFiles)) {
      if (files.includes(file)) managers.push(manager);
    }
    
    return managers;
  }

  handleError(error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    if (error.message.includes('API key not valid')) {
      console.log(chalk.yellow('\nℹ️  Get your API key at:'));
      console.log(chalk.blue('https://makersuite.google.com/app/apikey'));
    }
    process.exit(1);
  }

  // Project type parsers
  async parseNodeProject(files) {
    const packageJson = JSON.parse(
      await fs.readFile(join(this.currentDir, 'package.json'), 'utf8')
    );
    this.projectInfo.dependencies = packageJson.dependencies || {};
  }

  async parsePythonProject(files) {
    if (files.includes('requirements.txt')) {
      const requirements = await fs.readFile(
        join(this.currentDir, 'requirements.txt'), 
        'utf8'
      );
      this.projectInfo.dependencies = requirements
        .split('\n')
        .filter(line => line.trim());
    }
  }

  // ... other parser methods for different project types

  async getSourceFiles(directory = this.currentDir) {
    const sourceExtensions = [
      '.js', '.ts', '.jsx', '.tsx',  // JavaScript/TypeScript
      '.py',                         // Python
      '.java',                       // Java
      '.go',                         // Go
      '.rs',                         // Rust
      '.rb',                         // Ruby
      '.php',                        // PHP
      '.cs',                         // C#
      '.cpp', '.hpp', '.c', '.h'     // C/C++
    ];

    const files = [];
    
    async function scanDir(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          // Skip common exclude directories
          if (entry.name.startsWith('.') || 
              ['node_modules', 'venv', 'dist', 'build'].includes(entry.name)) {
            continue;
          }

          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (sourceExtensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error);
      }
    }

    await scanDir(directory);
    return files;
  }
}

// Start the generator
new ReadmeGenerator().init().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
