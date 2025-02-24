#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import Conf from 'conf';
import ora from 'ora';
import { validateApiKey, validateProjectStructure } from './utils/validation.js';
import path from 'path';
import boxen from 'boxen';
import gradient from 'gradient-string';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Modern CLI header
const showHeader = () => {
  console.log('\n' + boxen(
    gradient.pastel.multiline(
      `
   ╭─────────────────────────────╮
   │                             │
   │   ReadMI - README Builder   │
   │   ${chalk.dim('v1.1.9')}                  │
   │                             │
   ╰─────────────────────────────╯
    `
    ),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ));
};

const config = new Conf({
  projectName: 'readmi',
  defaults: {
    apiKey: null,
    defaultLicense: 'MIT',
    customPrompts: {},
    outputFormat: 'markdown'
  }
});

const PROJECT_TYPES = {
  nodejs: {
    icon: '⚡',
    files: ['package.json'],
    parser: 'parseNodeProject'
  },
  python: {
    icon: '🐍',
    files: ['requirements.txt', 'setup.py'],
    parser: 'parsePythonProject'
  },
  java: {
    icon: '☕',
    files: ['pom.xml', 'build.gradle'],
    parser: 'parseJavaProject'
  },
  rust: {
    icon: '🦀',
    files: ['Cargo.toml'],
    parser: 'parseRustProject'
  },
  go: {
    icon: '🐹',
    files: ['go.mod'],
    parser: 'parseGoProject'
  }
};

class ReadmeGenerator {
  constructor() {
    this.currentDir = process.cwd();
    this.spinner = ora();
    this.projectInfo = {
      type: 'unknown',
      files: [],
      dependencies: {},
      mainFile: null
    };
  }

  async init() {
    try {
      showHeader();
      
      this.spinner.start(chalk.blue('Initializing ReadMI...'));
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.spinner.succeed(chalk.green('ReadMI initialized successfully'));

      const apiKey = await this.getApiKey();
      await this.analyzeProject();
      await this.generateReadme(apiKey);
    } catch (error) {
      this.handleError(error);
    }
  }

  async getApiKey() {
    const savedApiKey = config.get('apiKey');
    
    if (savedApiKey) {
      this.spinner.succeed(chalk.green('Using saved API key'));
      return savedApiKey;
    }

    this.spinner.stop();
    console.log('\n' + boxen(chalk.yellow(' 🔑 API Key Required '), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'yellow'
    }));

    const { apiKey, saveKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: chalk.cyan('Enter your Google AI API Key:'),
        mask: '*',
        validate: input => {
          try {
            return validateApiKey(input);
          } catch (error) {
            return chalk.red('✖ ') + error.message;
          }
        }
      },
      {
        type: 'confirm',
        name: 'saveKey',
        message: chalk.cyan('Would you like to save this API key for future use?'),
        default: true
      }
    ]);

    if (saveKey) {
      config.set('apiKey', apiKey);
      this.spinner.succeed(chalk.green('API key saved successfully'));
    }

    return apiKey;
  }

  async analyzeProject() {
    this.spinner.start(chalk.blue('Analyzing project structure...'));
    
    const files = await fs.readdir(this.currentDir);
    
    for (const [type, config] of Object.entries(PROJECT_TYPES)) {
      if (config.files.some(file => files.includes(file))) {
        this.projectInfo.type = type;
        this.spinner.text = chalk.blue(`Detected ${config.icon} ${type.toUpperCase()} project`);
        await this[config.parser](files);
        break;
      }
    }

    this.projectInfo.files = await this.getSourceFiles();
    validateProjectStructure(this.projectInfo);
    
    this.spinner.succeed(chalk.green('Project analysis complete'));
  }

  async generateReadme(apiKey) {
    console.log(chalk.blue('\n🤖 Generating README content...'));
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      let packageInfo = {};
      try {
        const packageJson = await fs.readFile(join(this.currentDir, 'package.json'), 'utf8');
        packageInfo = JSON.parse(packageJson);
      } catch {}

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
      
      const processedContent = this.postProcessReadme(text, projectDetails);
      
      await fs.writeFile(join(this.currentDir, 'README.md'), processedContent);
      console.log(chalk.green('\n✨ README.md generated successfully!'));
    } catch (error) {
      throw new Error(`README generation failed: ${error.message}`);
    }
  }

  postProcessReadme(content, projectDetails) {
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
    
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      dependencies.npm = { ...packageJson.dependencies, ...packageJson.devDependencies };
    } catch {}

    try {
      const requirements = await fs.readFile('requirements.txt', 'utf8');
      dependencies.python = requirements.split('\n').filter(line => line.trim());
    } catch {}

    try {
      const composerJson = JSON.parse(await fs.readFile('composer.json', 'utf8'));
      dependencies.php = { ...composerJson.require, ...composerJson['require-dev'] };
    } catch {}

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
    this.spinner.fail(chalk.red('Error: ') + error.message);
    
    if (error.message.includes('API key not valid')) {
      console.log('\n' + boxen(
        chalk.yellow('Get your API key at:\n') +
        chalk.blue('https://makersuite.google.com/app/apikey'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'yellow'
        }
      ));
    }
    
    process.exit(1);
  }

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

  async getSourceFiles(directory = this.currentDir) {
    const sourceExtensions = [
      '.js', '.ts', '.jsx', '.tsx',  
      '.py',                   
      '.java',           
      '.go',                         
      '.rs',                   
      '.rb',                     
      '.php',                   
      '.cs',                      
      '.cpp', '.hpp', '.c', '.h'   
    ];

    const files = [];
    
    async function scanDir(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
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

// Start with style
console.clear();
new ReadmeGenerator().init().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
