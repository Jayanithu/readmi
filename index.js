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
  defaults: { apiKey: null }
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

      this.spinner.start(chalk.blue('Initializing ReadMI...'));
      const apiKey = await this.getApiKey();
      const projectInfo = await analyzeProject(this.currentDir);
      await this.generateReadme(apiKey, projectInfo);
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
      
      console.log('\n' + boxen(
        gradient.pastel.multiline([
          '📋 Available Gemini Models:',
          '',
          ...modelList.models.map(model => 
            `• ${chalk.cyan(model.name)}\n  ${chalk.gray(model.description || 'No description available')}`
          )
        ].join('\n')),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'green' }
      ));
    } catch (error) {
      this.spinner.fail(chalk.red('Failed to fetch models: ') + error.message);
      process.exit(1);
    }
  }

  showHeader() {
    console.log('\n' + boxen(
      gradient.pastel.multiline([
        '╭─────────────────────────────╮',
        '│                             │',
        '│   ReadMI - README Builder   │',
        '│         v2.1.2              │',
        '│                             │',
        '╰─────────────────────────────╯'
      ].join('\n')),
      { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
    ));
  }

  showVersion() {
    console.log(chalk.cyan('ReadMI v2.1.2'));
    process.exit(0);
  }

  showHelp() {
    console.log('\n' + boxen(
      gradient.pastel.multiline([
        '📘 ReadMI Commands:',
        '',
        '  readmi                    Generate README',
        '  readmi models             List available AI models',
        '  readmi config             Manage configuration',
        '  readmi config -r          Remove saved API key',
        '  readmi -v                 Display version',
        '  readmi --update           Update to latest version',
        '  readmi -h                 Display help',
        '',
        '✨ Visit: https://github.com/jayanithu/readmi'
      ].join('\n')),
      { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'blue' }
    ));
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

  async generateReadme(apiKey, projectInfo) {
    this.spinner.start(chalk.blue('Analyzing project...'));
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Preferred models in order of preference
      const preferredModels = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-pro",
        "gemini-1.0-pro"
      ];
      
      // Try models in sequence until one works
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
              topK: modelName.includes('pro') ? 40 : 32,
            }
          });

          // Test if the model works
          await tempModel.generateContent([{ text: "test" }]);
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
        // Fallback to basic gemini-pro
        workingModel = genAI.getGenerativeModel({
          model: "gemini-pro",
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            topP: 0.8,
            topK: 32,
          }
        });
      }

      // Show model capabilities
      const modelType = selectedModel.toLowerCase();
      if (modelType.includes('2.0')) {
        this.spinner.info(chalk.green('✨ Using Gemini 2.0 with enhanced capabilities'));
      } else if (modelType.includes('1.5')) {
        this.spinner.info(chalk.green('✨ Using Gemini 1.5 with improved performance'));
      } else if (modelType.includes('flash')) {
        this.spinner.info(chalk.green('⚡ Using Flash model for faster generation'));
      }

      // Create the prompt based on project info
      const promptText = `Create a modern README.md for ${projectInfo.name}:

Project Details:
${JSON.stringify(projectInfo, null, 2)}

Generate a README with these sections and emojis:

1. 🚀 Project Title
   - Clear project name with badges
   - One-line catchy description
   - Status badges

2. ✨ Features
   - 🎯 Core feature one
   - 🔥 Core feature two
   - ⚡ Core feature three
   - 💪 Core feature four

3. 📦 Installation
   \`\`\`bash
   npm install ${projectInfo.name}
   \`\`\`

4. 🎮 Quick Start
   - 🔑 API key setup (if needed)
   - 📝 Basic configuration
   - 🎯 First command

5. 💻 Usage Examples
   - 🌟 Basic usage
   - 🔥 Advanced features
   - 💡 Tips and tricks

6. ⚙️ Configuration
   - 🛠️ Available options
   - 🎨 Customization
   - 🔧 Advanced settings

${projectInfo.hasTests ? `7. 🧪 Testing
   - 🎯 Running tests
   - 📊 Coverage info
   - 🐛 Debug tips\n` : ''}

${projectInfo.hasDocker ? `8. 🐳 Docker Support
   - 🏗️ Build instructions
   - 🚀 Run commands
   - 🔧 Configuration\n` : ''}

9. 📝 License & Contributing
   - 📄 License info
   - 🤝 How to contribute
   - 👥 Contributors

Style Requirements:
- Use emojis for all sections and key points
- Keep content concise but informative
- Add code blocks with language tags
- Make it visually appealing
- Use tables for structured data

Important:
- Focus on developer experience
- Include working examples
- Keep it modern and clean
- Add relevant badges
- Make it easy to navigate

Please provide the content in markdown format.`;

      try {
        const result = await workingModel.generateContent([
          { text: promptText }
        ]);

        const response = await result.response;
        const readmeContent = response.text();
        
        if (!readmeContent) {
          throw new Error('Generated content is empty');
        }
        
        // Post-process to ensure emojis are preserved
        const processedContent = this.postProcessReadme(readmeContent, projectInfo);
        
        await fs.writeFile('README.md', processedContent);
        this.spinner.succeed(chalk.green('✨ README.md generated successfully!'));
      } catch (genError) {
        // Try with simpler prompt if the detailed one fails
        try {
          const fallbackPrompt = `Create a simple README for ${projectInfo.name} with these sections:
1. Project Description
2. Installation (npm install ${projectInfo.name})
3. Basic Usage
4. License

Keep it simple and clear, use markdown format.`;

          const fallbackResult = await workingModel.generateContent([
            { text: fallbackPrompt }
          ]);

          const fallbackResponse = await fallbackResult.response;
          const fallbackContent = fallbackResponse.text();

          if (!fallbackContent) {
            throw new Error('Generated content is empty');
          }

          const processedContent = this.postProcessReadme(fallbackContent, projectInfo);
          await fs.writeFile('README.md', processedContent);
          this.spinner.succeed(chalk.yellow('✨ README.md generated with minimal content (fallback mode)'));
        } catch (fallbackError) {
          throw new Error(`Failed to generate content: ${fallbackError.message}`);
        }
      }
    } catch (error) {
      if (error.message.includes('not found for API version')) {
        throw new Error('API configuration error. Please check your API key and try again. Error: ' + error.message);
      }
      throw new Error(`README generation failed: ${error.message}`);
    }
  }

  postProcessReadme(content, projectInfo) {
    // NPM and status badges
    const npmBadges = [
      `[![npm version](https://img.shields.io/npm/v/@jayanithu/readmi)](https://www.npmjs.com/package/@jayanithu/readmi)`,
      `[![npm downloads](https://img.shields.io/npm/dm/@jayanithu/readmi)](https://www.npmjs.com/package/@jayanithu/readmi)`,
      `[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)`
    ];

    // Create header with rocket emoji and description
    let enhancedContent = `# 🚀 @jayanithu/readmi: Modern README Generator Powered by AI\n\n`;
    enhancedContent += `${npmBadges.join('\n')}\n\n`;
    enhancedContent += `⚡ Generate stunning README files effortlessly with AI!\n\n`;

    // Add the rest of the content
    enhancedContent += content
      .replace(/^# .*$/m, '') // Remove the original title if present
      .replace(/\n(#+)\s/g, '\n\n$1 ')  // Add spacing around headers
      .replace(/```(\w+)\n/g, '```$1\n') // Preserve code block language tags
      .replace(/\n-\s/g, '\n• ') // Use bullet points instead of dashes
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/(\n\n---\n\n)/g, '\n\n---\n\n') // Clean horizontal rules
      .trim();

    // Add footer
    enhancedContent += '\n\n---\n\n_Made with ❤️ using ReadMI_\n';

    return enhancedContent;
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

    console.log('\n' + boxen(
      gradient.pastel.multiline([
        '⚙️ Configuration Commands:',
        '',
        '  readmi config -r          Remove saved API key',
        '',
        '📝 Current Configuration:',
        `  API Key: ${config.has('apiKey') ? '🔑 Saved' : '❌ Not saved'}`
      ].join('\n')),
      { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'magenta' }
    ));
  }

  handleError(error) {
    this.spinner.fail(chalk.red('Error: ') + error.message);
    process.exit(1);
  }
}

console.clear();
new ReadmeGenerator().init().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});