#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import { validateApiKey, validateProjectStructure } from './utils/validation.js';
import { PROJECT_TYPES, FILE_EXTENSIONS } from './config/projectTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    const { apiKey } = await inquirer.prompt([{
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
    }]);
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
      
      // Enhanced project analysis
      const projectDetails = {
        ...this.projectInfo,
        gitInfo: await this.getGitInfo(),
        dependencies: await this.getAllDependencies(),
        structure: await this.getProjectStructure(),
        mainLanguage: await this.detectMainLanguage(),
        packageManagers: await this.detectPackageManagers()
      };

      const prompt = `Create a comprehensive README.md for a ${projectDetails.type} project.
      
Project Details:
- Main Language: ${projectDetails.mainLanguage}
- Package Managers: ${projectDetails.packageManagers.join(', ')}
- Dependencies: ${JSON.stringify(projectDetails.dependencies, null, 2)}
- Project Structure: ${projectDetails.structure}
${projectDetails.gitInfo ? `- Git Repository: ${projectDetails.gitInfo}` : ''}

Please include:
1. Clear project title and description
2. Comprehensive installation instructions for all detected package managers
3. Detailed usage examples
4. Complete list of dependencies and requirements
5. Development setup instructions
6. Testing instructions
7. Contributing guidelines
8. License information
9. Project structure overview
10. Troubleshooting section

Format the README with proper markdown, including:
- Code blocks with language specification
- Tables where appropriate
- Badges for version, license, etc.
- Emojis for better readability
- Clear section headers`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      await fs.writeFile(join(this.currentDir, 'README.md'), text);
      console.log(chalk.green('\n✨ README.md generated successfully!'));
    } catch (error) {
      throw new Error(`README generation failed: ${error.message}`);
    }
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
}

// Start the generator
new ReadmeGenerator().init().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
