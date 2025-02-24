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
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = this.generatePrompt();
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    await fs.writeFile(join(this.currentDir, 'README.md'), text);
    console.log(chalk.green('\n✨ README.md generated successfully!'));
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
