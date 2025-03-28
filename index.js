#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import Conf from 'conf';
import ora from 'ora';
import path from 'path';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const args = process.argv.slice(2);

const config = new Conf({
  projectName: 'readmi',
  defaults: { 
    apiKey: null,
    preferredModel: null,
    preferredLanguage: 'en'
  }
});

async function analyzeProject(dir) {
  const info = {
    name: '',
    description: '',
    version: '',
    dependencies: {},
    devDependencies: {},
    scripts: {},
    files: [],
    hasTests: false,
    hasDocker: false,
    hasGithubActions: false
  };
  try {
    const packageJson = JSON.parse(await fs.readFile(join(dir, 'package.json'), 'utf8'));
    Object.assign(info, packageJson);
    const files = await fs.readdir(dir);
    info.files = files;
    info.hasTests = files.some(f => f.includes('test') || f.includes('spec'));
    info.hasDocker = files.includes('Dockerfile') || files.includes('docker-compose.yml');
    info.hasGithubActions = files.includes('.github');
    return info;
  } catch (error) {
    return info;
  }
}

class ReadmeGenerator {
  constructor() {
    this.currentDir = process.cwd();
    this.spinner = ora();
  }

  async init() {
    try {
      this.showHeader();

      if (args.includes('-v') || args.includes('--version')) {
        this.showVersion();
        return;
      }

      if (args.includes('--update')) {
        const spinner = ora('Checking for updates...').start();
        try {
          execSync('npm install -g @jayanithu/readmi@latest');
          spinner.succeed(chalk.green('Successfully updated to the latest version!'));
          process.exit(0);
        } catch (error) {
          spinner.fail(chalk.red('Update failed: ') + error.message);
          process.exit(1);
        }
      }

      if (args.includes('-h') || args.includes('--help')) {
        this.showHelp();
        return;
      }

      if (args[0] === 'models') {
        await this.listAvailableModels();
        return;
      }

      if (args[0] === 'config') {
        await this.handleConfig();
        return;
      }
      
      if (args[0] === 'language' || args[0] === 'lang') {
        await this.selectLanguage();
        return;
      }

      this.spinner.start(chalk.blue('Initializing ReadMI...'));
      const apiKey = await this.getApiKey();
      const projectInfo = await analyzeProject(this.currentDir);
      
      let language = config.get('preferredLanguage') || 'en';
      if (args.includes('--select-language') || args.includes('-sl')) {
        language = await this.selectLanguage();
      }
      
      await this.generateReadme(apiKey, projectInfo, language);
    } catch (error) {
      this.handleError(error);
    }
  }

  async listAvailableModels() {
    const apiKey = await this.getApiKey();
    this.spinner.start(chalk.blue('Fetching available models...'));
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelList = await genAI.listModels();
      this.spinner.stop();
      console.log(
        '\n' +
          boxen(
            gradient.pastel.multiline(
              [
                '📋 Available Gemini Models:',
                '',
                ...modelList.models.map(
                  model =>
                    `• ${chalk.cyan(model.name)}\n  ${chalk.gray(model.description || 'No description available')}`
                )
              ].join('\n')
            ),
            { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'green' }
          )
      );
    } catch (error) {
      this.spinner.fail(chalk.red('Failed to fetch models: ') + error.message);
      process.exit(1);
    }
  }

  showHeader() {
    console.log(
      '\n' +
        boxen(
          gradient.pastel.multiline(
            [
              '╭─────────────────────────────╮',
              '│                             │',
              '│   ReadMI - README Builder   │',
              '│         v2.3.2              │',
              '│                             │',
              '╰─────────────────────────────╯'
            ].join('\n')
          ),
          { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
        )
    );
  }

  showVersion() {
    console.log(chalk.cyan('ReadMI v2.3.2'));
    process.exit(0);
  }

  showHelp() {
    console.log(
      '\n' +
        boxen(
          gradient.pastel.multiline(
            [
              '📘 ReadMI Commands:',
              '',
              '  readmi                    Generate README',
              '  readmi models             List available AI models',
              '  readmi config             Manage configuration',
              '  readmi config -r          Remove saved API key',
              '  readmi config -rm         Remove preferred model',
              '  readmi config -rl         Remove preferred language',
              '  readmi config -l          Set preferred language',
              '  readmi -v                 Display version',
              '  readmi --update           Update to latest version',
              '  readmi -h                 Display help',
              '',
              '✨ Visit: https://github.com/jayanithu/readmi'
            ].join('\n')
          ),
          { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'blue' }
        )
    );
    process.exit(0);
  }

  async getApiKey() {
    const savedApiKey = config.get('apiKey');
    if (savedApiKey) return savedApiKey;

    this.spinner.stop();
    const { apiKey, saveKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: chalk.cyan('Enter your Google AI API Key:'),
        mask: '*'
      },
      {
        type: 'confirm',
        name: 'saveKey',
        message: chalk.cyan('Save this API key for future use?'),
        default: true
      }
    ]);

    if (saveKey) {
      config.set('apiKey', apiKey);
      this.spinner.succeed(chalk.green('API key saved'));
    }
    return apiKey;
  }

  async generateReadme(apiKey, projectInfo, language = 'en') {
    this.spinner.start(chalk.blue('Analyzing project...'));

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const preferredModels = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-pro',
        'gemini-1.0-pro'
      ];
      let selectedModel = null;
      let workingModel = null;

      for (const modelName of preferredModels) {
        try {
          const tempModel = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: modelName.includes('flash') ? 0.9 : 0.7,
              maxOutputTokens: modelName.includes('pro') ? 2048 : 1024,
              topP: modelName.includes('flash') ? 0.9 : 0.8,
              topK: modelName.includes('pro') ? 40 : 32
            }
          });
          await tempModel.generateContent([{ text: 'test' }]);
          workingModel = tempModel;
          selectedModel = modelName;
          this.spinner.info(chalk.blue(`Found working model: ${modelName}`));
          break;
        } catch (error) {
          this.spinner.warn(chalk.yellow(`Model ${modelName} not available, trying next...`));
          continue;
        }
      }

      if (!workingModel || !selectedModel) {
        workingModel = genAI.getGenerativeModel({
          model: 'gemini-pro',
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            topP: 0.8,
            topK: 32
          }
        });
      }

      const modelType = selectedModel?.toLowerCase() || '';
      if (modelType.includes('2.0')) {
        this.spinner.info(chalk.green('✨ Using Gemini 2.0 with enhanced capabilities'));
      } else if (modelType.includes('1.5')) {
        this.spinner.info(chalk.green('✨ Using Gemini 1.5 with improved performance'));
      } else if (modelType.includes('flash')) {
        this.spinner.info(chalk.green('⚡ Using Flash model for faster generation'));
      }

      this.spinner.info(chalk.blue(`Generating README in ${this.getLanguageName(language)}`));

      const projectType = this.determineProjectType(projectInfo);
      
      const promptText = `Create a comprehensive, accurate README.md for the project "${projectInfo.name}" in ${this.getLanguageName(language)}.

Project Details:
${JSON.stringify(projectInfo, null, 2)}

Project Type Analysis:
${projectType.join('\n')}

Generate a README with these sections (adapt as needed for the specific project type):

1. 🚀 Project Title and Description
   - Clear project name with appropriate badges (npm, license, build status, etc.)
   - Concise description that explains the project's purpose
   - If applicable: version information, status (beta, stable, etc.)

2. ✨ Features
   - List 4-6 key features with emoji prefixes
   - Focus on what makes this project unique or valuable
   - Highlight technical capabilities and user benefits

3. 📦 Installation
   - Provide clear, step-by-step installation instructions
   - Include all prerequisites and dependencies
   - Show multiple installation methods if applicable (npm, yarn, bun, pip, etc.)
   - Include platform-specific instructions if needed

4. 🎮 Quick Start / Usage
   - Show a minimal working example to get started quickly
   - Include code snippets with proper syntax highlighting
   - Explain key configuration options or environment variables
   - For APIs: show basic request/response examples

5. 📖 Documentation
   - Link to or include API documentation if applicable
   - Explain core concepts and architecture
   - Provide examples for common use cases
   - Include diagrams or screenshots if helpful

6. ⚙️ Configuration
   - Document all configuration options
   - Explain default values and possible alternatives
   - Show configuration file examples
   - Explain environment variables

7. 🧪 Testing
   - Instructions for running tests
   - Explanation of test coverage
   - How to write new tests

8. 🤝 Contributing
   - Guidelines for contributors
   - Code of conduct
   - Development setup instructions
   - Pull request process

9. 📝 License
   - Specify the license type
   - Link to the full license text

10. 👏 Acknowledgements
    - Credit contributors, inspirations, and dependencies
    - Link to related projects

Adapt the sections based on the project type:
- For libraries/frameworks: Focus on API documentation, usage examples
- For CLI tools: Focus on command reference, options, examples
- For web applications: Include deployment instructions, screenshots
- For mobile apps: Include store links, platform requirements
- For data science projects: Include dataset information, model details
- For games: Include controls, gameplay instructions

Style Guidelines:
- Use clear, concise language
- Include relevant code examples with proper syntax highlighting
- Use emojis for section headers to improve readability
- Use tables for structured data when appropriate
- Include badges for important information (build status, version, etc.)
- Organize information hierarchically with proper heading levels
- Ensure all links are functional and relevant
- Include visuals (screenshots, diagrams) where they add value

Technical Accuracy:
- Ensure all command examples work as written
- Verify all API examples are syntactically correct
- Check that installation instructions are complete
- Confirm compatibility information is accurate
- Ensure version numbers are consistent throughout

Write the entire README in ${this.getLanguageName(language)}.
Format the output as clean markdown without any wrapper code blocks.`;

      try {
        const result = await workingModel.generateContent([{ text: promptText }]);
        const response = await result.response;
        const readmeContent = response.text();

        if (!readmeContent) {
          throw new Error('Generated content is empty');
        }

        const processedContent = this.postProcessReadme(readmeContent);
        let filename = 'README.md';
        if (language !== 'en') {
          filename = `README.${language}.md`;
        }
        
        await fs.writeFile(filename, processedContent);
        this.spinner.succeed(chalk.green(`✨ ${filename} generated successfully in ${this.getLanguageName(language)}!`));
      } catch (error) {
        if (error.message.includes('not found for API version')) {
          throw new Error('API configuration error. Please check your API key and try again. Error: ' + error.message);
        }
        throw new Error(`README generation failed: ${error.message}`);
      }
    } catch (error) {
      throw error;
    }
  }

  determineProjectType(projectInfo) {
    const projectType = [];
    
    if (projectInfo.bin || Object.keys(projectInfo.bin || {}).length > 0) {
      projectType.push('- This is a command-line interface (CLI) tool');
    }
    
    else if (projectInfo.main) {
      projectType.push('- This is a library/package meant to be imported by other projects');
    }
    
    if (projectInfo.dependencies) {
      if (projectInfo.dependencies.react) {
        projectType.push('- This is a React application/component');
      } else if (projectInfo.dependencies.vue) {
        projectType.push('- This is a Vue.js application/component');
      } else if (projectInfo.dependencies.express || projectInfo.dependencies['@nestjs/core']) {
        projectType.push('- This is a Node.js backend/API service');
      } else if (projectInfo.dependencies.electron) {
        projectType.push('- This is an Electron desktop application');
      } else if (projectInfo.dependencies['react-native']) {
        projectType.push('- This is a React Native mobile application');
      }
    }
    
    if (projectInfo.devDependencies) {
      const testingTools = [];
      if (projectInfo.devDependencies.jest) testingTools.push('Jest');
      if (projectInfo.devDependencies.mocha) testingTools.push('Mocha');
      if (projectInfo.devDependencies.cypress) testingTools.push('Cypress');
      if (projectInfo.devDependencies.playwright) testingTools.push('Playwright');
      
      if (testingTools.length > 0) {
        projectType.push(`- Testing is done with: ${testingTools.join(', ')}`);
      }
    }
    
    if (projectInfo.hasDocker) {
      projectType.push('- This project has Docker support');
    }
    
    if (projectInfo.hasGithubActions) {
      projectType.push('- This project uses GitHub Actions for CI/CD');
    }
    
    const fileExtensions = projectInfo.files.map(file => {
      const ext = file.split('.').pop();
      return ext;
    });
    
    if (fileExtensions.includes('py')) {
      projectType.push('- This project uses Python');
    } else if (fileExtensions.includes('go')) {
      projectType.push('- This project uses Go');
    } else if (fileExtensions.includes('rs')) {
      projectType.push('- This project uses Rust');
    } else if (fileExtensions.includes('java') || fileExtensions.includes('kt')) {
      projectType.push('- This project uses Java/Kotlin');
    } else if (fileExtensions.includes('rb')) {
      projectType.push('- This project uses Ruby');
    } else if (fileExtensions.includes('php')) {
      projectType.push('- This project uses PHP');
    } else if (fileExtensions.includes('ts') || fileExtensions.includes('tsx')) {
      projectType.push('- This project uses TypeScript');
    } else if (fileExtensions.includes('js') || fileExtensions.includes('jsx')) {
      projectType.push('- This project uses JavaScript');
    }
    
    if (projectType.length === 0) {
      projectType.push('- Project type could not be automatically determined');
      projectType.push('- Generating a generic README structure');
    }
    
    return projectType;
  }

  getLanguageMap() {
    return {
      'en': 'English',
      'es': 'Spanish (Español)',
      'fr': 'French (Français)',
      'de': 'German (Deutsch)',
      'zh': 'Chinese (中文)',
      'ja': 'Japanese (日本語)',
      'pt': 'Portuguese (Português)',
      'ru': 'Russian (Русский)',
      'hi': 'Hindi (हिन्दी)',
      'ar': 'Arabic (العربية)'
    };
  }

  getLanguageName(code) {
    return this.getLanguageMap()[code] || code;
  }

  postProcessReadme(content) {
    let processed = content.replace(/```markdown/g, '```');
    if (processed.startsWith('```')) {
      processed = processed.replace(/^```[a-z]*\n?/, '');
    }
    processed = processed
      .replace(/\n(#+)\s/g, '\n\n$1 ')
      .replace(/\n-\s/g, '\n• ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    processed += '\n\n---\n_Made with ❤️ using ReadMI by jayanithu_\n';
    return processed;
  }

  async handleConfig() {

    if (args[1] === '--remove-key' || args[1] === '-r') {
      if (config.has('apiKey')) {
        config.delete('apiKey');
        console.log(chalk.green('✅ API key removed successfully'));
      } else {
        console.log(chalk.yellow('ℹ️ No API key found in configuration'));
      }
      return;
    }
    if (args[1] === '--remove-model' || args[1] === '-rm') {
      if (config.has('preferredModel')) {
        config.delete('preferredModel');
        console.log(chalk.green('✅ Preferred model removed successfully'));
      } else {
        console.log(chalk.yellow('ℹ️ No preferred model found in configuration'));
      }
      return;
    }
    if (args[1] === '--remove-language' || args[1] === '-rl') {
      if (config.has('preferredLanguage')) {
        config.delete('preferredLanguage');
        console.log(chalk.green('✅ Preferred language removed successfully'));
      } else {
        console.log(chalk.yellow('ℹ️ No preferred language found in configuration'));
      }
      return;
    }
    if (args[1] === '--language' || args[1] === '-l') {
      await this.selectLanguage();
      return;
    }
    console.log(
      '\n' +
        boxen(
          gradient.pastel.multiline(
            [
              '⚙️ Configuration Commands:',
              '',
              '  readmi config -r          Remove saved API key',
              '  readmi config -rm         Remove preferred model',
              '  readmi config -rl         Remove preferred language',
              '  readmi config -l          Set preferred language',
              '',
              '📝 Current Configuration:',
              `  API Key: ${config.has('apiKey') ? '🔑 Saved' : '❌ Not saved'}`,
              `  Preferred Model: ${config.has('preferredModel') ? chalk.cyan(config.get('preferredModel')) : '❌ Not set'}`,
              `  Preferred Language: ${config.has('preferredLanguage') ? chalk.cyan(this.getLanguageName(config.get('preferredLanguage'))) : '❌ Not set'}`
            ].join('\n')
          ),
          { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'magenta' }
        )
    );
  }

  getLanguageName(code) {
    const languageMap = {
      'en': 'English',
      'es': 'Spanish (Español)',
      'fr': 'French (Français)',
      'de': 'German (Deutsch)',
      'zh': 'Chinese (中文)',
      'ja': 'Japanese (日本語)',
      'pt': 'Portuguese (Português)',
      'ru': 'Russian (Русский)',
      'hi': 'Hindi (हिन्दी)',
      'ar': 'Arabic (العربية)'
    };
    return languageMap[code] || code;
  }

  handleError(error) {
    this.spinner.fail(chalk.red('Error: ') + error.message);
    process.exit(1);
  }

  async selectLanguage() {
    const savedLanguage = config.get('preferredLanguage');
    
    const languages = [
      { name: 'English', value: 'en' },
      { name: 'Spanish (Español)', value: 'es' },
      { name: 'French (Français)', value: 'fr' },
      { name: 'German (Deutsch)', value: 'de' },
      { name: 'Chinese (中文)', value: 'zh' },
      { name: 'Japanese (日本語)', value: 'ja' },
      { name: 'Portuguese (Português)', value: 'pt' },
      { name: 'Russian (Русский)', value: 'ru' },
      { name: 'Hindi (हिन्दी)', value: 'hi' },
      { name: 'Arabic (العربية)', value: 'ar' }
    ];
    
    this.spinner.stop();
    const { language } = await inquirer.prompt([
      {
        type: 'list',
        name: 'language',
        message: chalk.cyan('Select README language:'),
        choices: languages,
        default: languages.findIndex(lang => lang.value === savedLanguage) || 0
      }
    ]);
    
    const { saveLanguage } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveLanguage',
        message: chalk.cyan('Save this language as preferred?'),
        default: true
      }
    ]);
    
    if (saveLanguage) {
      config.set('preferredLanguage', language);
      this.spinner.succeed(chalk.green(`Language preference saved: ${language}`));
    }
    
    return language;
  }
}

console.clear();
new ReadmeGenerator()
  .init()
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
