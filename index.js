#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import inquirer from 'inquirer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to generate AI text
async function generateAIText(prompt, apiKey) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error(chalk.red("❌ AI generation failed. Using default values."));
        return "No AI-generated content available.";
    }
}

async function analyzeProject(directory) {
    const projectInfo = {
        type: 'unknown',
        files: [],
        dependencies: {},
        mainFile: null
    };

    try {
        const files = fs.readdirSync(directory);
        
        // Detect project type
        if (files.includes('package.json')) {
            projectInfo.type = 'nodejs';
            const packageJson = JSON.parse(fs.readFileSync(join(directory, 'package.json'), 'utf8'));
            projectInfo.dependencies = packageJson.dependencies || {};
        } else if (files.includes('requirements.txt')) {
            projectInfo.type = 'python';
            const requirements = fs.readFileSync(join(directory, 'requirements.txt'), 'utf8');
            projectInfo.dependencies = requirements.split('\n').filter(line => line.trim());
        } else if (files.includes('pom.xml')) {
            projectInfo.type = 'java';
        } else if (files.includes('go.mod')) {
            projectInfo.type = 'go';
        } else if (files.includes('Cargo.toml')) {
            projectInfo.type = 'rust';
        }

        // Get source files
        projectInfo.files = await getSourceFiles(directory);
        
        return projectInfo;
    } catch (error) {
        console.error('Error analyzing project:', error);
        return projectInfo;
    }
}

async function getSourceFiles(directory) {
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
    
    function scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            
            if (entry.name.startsWith('.') || 
                ['node_modules', 'venv', 'dist', 'build', 'target'].includes(entry.name)) {
                continue;
            }

            if (entry.isDirectory()) {
                scanDir(fullPath);
            } else if (sourceExtensions.some(ext => entry.name.endsWith(ext))) {
                files.push(fullPath);
            }
        }
    }

    scanDir(directory);
    return files;
}

function generatePrompt(projectInfo) {
    return `Generate a comprehensive README.md for a ${projectInfo.type} project.
Project Analysis:
- Type: ${projectInfo.type}
- Number of source files: ${projectInfo.files.length}
- Dependencies: ${JSON.stringify(projectInfo.dependencies, null, 2)}

Please include:
1. Project title and description
2. Installation instructions
3. Usage examples
4. Dependencies list
5. Contributing guidelines
6. License information
7. Project structure overview`;
}

async function generateReadme() {
    try {
        console.log(chalk.blue('📝 README Generator Starting...'));

        const { apiKey } = await inquirer.prompt([
            {
                type: 'input',
                name: 'apiKey',
                message: chalk.yellow('Enter your Google AI API Key:'),
                validate: input => input.length > 0 ? true : 'API key is required'
            }
        ]);

        console.log(chalk.blue('\n🔍 Analyzing project structure...'));
        const currentDir = process.cwd();
        const projectInfo = await analyzeProject(currentDir);

        console.log(chalk.blue('\n🤖 Generating README content...'));
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const prompt = generatePrompt(projectInfo);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        fs.writeFileSync(join(currentDir, 'README.md'), text);
        console.log(chalk.green('\n✨ README.md generated successfully!'));
        
    } catch (error) {
        console.error(chalk.red('\n❌ Error:'), error.message);
        if (error.message.includes('API key not valid')) {
            console.log(chalk.yellow('\nℹ️  Please get a valid API key from:'));
            console.log(chalk.blue('https://makersuite.google.com/app/apikey'));
        }
        process.exit(1);
    }
}

generateReadme().catch(console.error);
