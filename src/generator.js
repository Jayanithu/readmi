import fs from 'fs/promises';
import { statSync } from 'fs';
import chalk from 'chalk';
import { getLanguageName, determineProjectType, generateBadges, postProcessReadme } from './utils.js';
import { mergeReadmeContent, updateSpecificSections, updateVersionInReadme, createDiffSummary } from './readmeUpdater.js';

export function buildPrompt(projectInfo, language) {
  const projectType = determineProjectType(projectInfo);
  const badges = generateBadges(projectInfo);
  const projectName = projectInfo.displayName || projectInfo.name || 'Project';
  
  let sourceCodeContext = '';
  const sourceCodeEntries = Object.entries(projectInfo.sourceCode || {}).slice(0, 5);
  if (sourceCodeEntries.length > 0) {
    sourceCodeContext = '\n\n=== SOURCE CODE ANALYSIS ===\n';
    sourceCodeContext += 'The following source files were analyzed to understand the project:\n\n';
    for (const [filePath, content] of sourceCodeEntries) {
      sourceCodeContext += `--- File: ${filePath} ---\n${content.substring(0, 2000)}\n\n`;
    }
  }
  
  let contextInfo = `=== PROJECT INFORMATION ===
Project Name: ${projectName}
Package Name: ${projectInfo.name || 'N/A'}
Description: ${projectInfo.description || 'No description in package.json - analyze from code'}
Version: ${projectInfo.version || '1.0.0'}
License: ${projectInfo.license || 'MIT'}`;

  if (projectInfo.repository) {
    const repoUrl = typeof projectInfo.repository === 'string' ? projectInfo.repository : projectInfo.repository.url;
    contextInfo += `\nRepository: ${repoUrl}`;
  }
  if (projectInfo.homepage) {
    contextInfo += `\nHomepage: ${projectInfo.homepage}`;
  }
  if (projectInfo.author) {
    contextInfo += `\nAuthor: ${projectInfo.author}`;
  }

  contextInfo += `\n\n=== PROJECT STRUCTURE ===
Entry Points: ${projectInfo.entryPoints?.join(', ') || 'Not specified'}
Main File: ${projectInfo.main || projectInfo.mainFile || 'Not specified'}
Total Source Files: ${projectInfo.sourceFiles?.length || 0}
Key Directories: ${projectInfo.projectStructure?.directories?.join(', ') || 'None'}`;

  if (projectInfo.detectedFeatures && projectInfo.detectedFeatures.length > 0) {
    contextInfo += `\nDetected Features/Technologies: ${projectInfo.detectedFeatures.join(', ')}`;
  }

  contextInfo += `\n\n=== DEPENDENCIES & TOOLS ===
Dependencies: ${Object.keys(projectInfo.dependencies || {}).length} packages
Dev Dependencies: ${Object.keys(projectInfo.devDependencies || {}).length} packages`;

  if (Object.keys(projectInfo.scripts || {}).length > 0) {
    contextInfo += `\nAvailable Scripts: ${Object.keys(projectInfo.scripts).join(', ')}`;
  }

  if (projectInfo.envVars && projectInfo.envVars.length > 0) {
    contextInfo += `\nEnvironment Variables: ${projectInfo.envVars.join(', ')}`;
  }

  contextInfo += `\n\n=== PROJECT CAPABILITIES ===
Has Tests: ${projectInfo.hasTests ? 'Yes' : 'No'}
Has Docker: ${projectInfo.hasDocker ? 'Yes' : 'No'}
Has CI/CD: ${projectInfo.hasGithubActions ? 'Yes (GitHub Actions)' : 'No'}`;

  if (projectInfo.keywords && projectInfo.keywords.length > 0) {
    contextInfo += `\nKeywords: ${projectInfo.keywords.join(', ')}`;
  }

  contextInfo += `\n\n${projectType.join('\n')}`;
  
  return `You are an expert technical writer. Create a professional, concise, and accurate README.md for the project "${projectName}" in ${getLanguageName(language)}.

IMPORTANT: 
- Use the project name "${projectName}" (not the package name unless they're the same)
- Analyze the source code provided to understand what the project actually does
- Only include sections that are relevant and useful
- Be selective - a good README is concise and focused
- Extract actual features from the code, not generic ones
- Use real examples from the codebase when possible

${contextInfo}${sourceCodeContext}

Suggested Badges (only use if relevant):
${badges}

=== README REQUIREMENTS ===

Create a README with ONLY the following sections (skip sections that don't apply):

1. **Title & Description** (REQUIRED)
   - Use the project name: "${projectName}"
   - Write a clear, engaging description based on what the code actually does
   - Add relevant badges only if applicable (format them properly on one line)
   - Include version if available
   - Make it visually appealing with proper formatting

2. **Features** (REQUIRED if you can identify them from code)
   - List 3-5 actual features extracted from the source code
   - Use bullet points with emojis (✨, 🚀, ⚡, etc.) to make it visually appealing
   - Be specific about what the project does, not generic
   - Focus on unique capabilities
   - Format: • ✨ Feature description

3. **Installation** (REQUIRED)
   - Provide accurate installation steps based on the project type
   - Include prerequisites if needed
   - Show the actual installation command in a \`\`\`bash code block
   - Example format:
     \`\`\`bash
     npm install package-name
     \`\`\`

4. **Usage/Quick Start** (REQUIRED)
   - Show a minimal working example
   - Extract actual usage patterns from the source code
   - Include code examples in proper code blocks with language tags
   - For CLI tools: show actual commands in \`\`\`bash blocks
   - For libraries: show import/require and basic usage in appropriate language blocks (\`\`\`javascript, \`\`\`python, etc.)
   - Example format:
     \`\`\`javascript
     const example = require('package');
     example.doSomething();
     \`\`\`

5. **Configuration** (ONLY if env vars or config files exist)
   - Document environment variables if detected
   - Show configuration examples in \`\`\`json or \`\`\`env code blocks
   - Format environment variables clearly

6. **Scripts/Commands** (ONLY if scripts exist in package.json)
   - List available npm/yarn scripts with brief descriptions

7. **Testing** (ONLY if tests are detected)
   - Show how to run tests
   - Brief testing instructions

8. **Contributing** (OPTIONAL - can be brief)
   - Basic contribution guidelines

9. **License** (REQUIRED)
   - Specify the license type

10. **Additional Sections** (ONLY if relevant)
    - API Documentation (if it's an API/library)
    - Deployment (if it's a web app)
    - Architecture (if complex enough to warrant it)

=== CODE BLOCK FORMATTING ===
CRITICAL: All code examples MUST be properly formatted:
- Installation commands: Use \`\`\`bash code blocks
- Code examples: Use appropriate language tags (\`\`\`javascript, \`\`\`python, \`\`\`typescript, etc.)
- Configuration examples: Use \`\`\`json or \`\`\`yaml
- CLI commands: Use \`\`\`bash
- NEVER leave code blocks without language tags
- NEVER use \`\`\`markdown for code examples
- Ensure every code block has proper opening and closing tags

=== STYLE GUIDELINES ===
- Use clear, professional language with engaging tone
- Include code examples with proper syntax highlighting (ALWAYS use language tags)
- Use emojis in section headers (🚀, ✨, 📦, 🎮, etc.) to make it visually appealing
- Keep it concise but informative
- Ensure all code examples are accurate and work
- Use proper markdown formatting with good spacing
- Make it scannable with clear headings
- Add visual interest with badges, emojis, and well-formatted code blocks
- DO NOT include a Table of Contents section

=== OUTPUT FORMAT ===
CRITICAL FORMATTING RULES:
- Write clean markdown - DO NOT wrap the entire README in code blocks
- DO NOT start the output with \`\`\`bash or any code block markers
- DO NOT end the output with \`\`\`bash or any code block markers
- The output should start directly with: # ${projectName}
- Only use code blocks (\`\`\`bash, \`\`\`javascript, etc.) INSIDE the README for actual code examples
- The entire README content should be plain markdown, not wrapped in code blocks
- Use the actual project name "${projectName}" throughout
- Focus on what makes this project useful and unique
- Make it visually appealing with proper formatting
- NO Table of Contents should be included
- Example of correct start: # ${projectName}\n\nDescription here...
- Example of WRONG start: \`\`\`bash\n# ${projectName}`;
}

export async function generateReadme(apiKey, projectInfo, language, model, spinner) {
  spinner.start(chalk.gray('  Analyzing project...'));
  
  if (projectInfo.sourceFiles?.length > 0) {
    spinner.text = chalk.gray(`  Found ${projectInfo.sourceFiles.length} source files`);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  spinner.text = chalk.gray('  Analyzing codebase structure...');
  await new Promise(resolve => setTimeout(resolve, 200));
  
  spinner.text = chalk.gray(`  Generating README in ${getLanguageName(language)}...`);

  const promptText = buildPrompt(projectInfo, language);

  try {
    const result = await model.generateContent([{ text: promptText }]);
    const response = await result.response;
    const readmeContent = response.text();

    if (!readmeContent) {
      throw new Error('Generated content is empty');
    }

    const processedContent = postProcessReadme(readmeContent);
    let filename = 'README.md';
    if (language !== 'en') {
      filename = `README.${language}.md`;
    }
    
    await fs.writeFile(filename, processedContent);
    
    const stats = statSync(filename);
    const fileSizeKB = (stats.size / 1024).toFixed(1);
    const lineCount = processedContent.split('\n').length;
    
    spinner.succeed(chalk.green(`  ${filename} generated`));
    console.log(
      chalk.gray(`  ${lineCount} lines • ${fileSizeKB} KB • ${getLanguageName(language)}`) + '\n'
    );
    console.log(
      chalk.cyan('  ✨ Pro tip: ') +
      chalk.gray('Double-check your README at ') +
      chalk.blue.underline('https://readmi.jayanithu.dev/editor') + '\n'
    );
  } catch (error) {
    if (error.message.includes('not found for API version')) {
      throw new Error('API configuration error. Please check your API key and try again. Error: ' + error.message);
    }
    throw new Error(`README generation failed: ${error.message}`);
  }
}

/**
 * Update existing README with smart merging
 */
export async function updateReadme(apiKey, projectInfo, language, model, spinner, readmeAnalysis, updateChoice, sectionsToUpdate = []) {
  try {
    if (updateChoice === 'version') {
      // Version-only update
      spinner.start(chalk.gray('  Updating version numbers...'));
      
      const updatedContent = updateVersionInReadme(readmeAnalysis.content, projectInfo.version);
      await fs.writeFile('README.md', updatedContent);
      
      spinner.succeed(chalk.green('  README version updated'));
      console.log(chalk.gray(`  Updated to version ${projectInfo.version}\n`));
      return;
    }

    // Generate new README content
    spinner.start(chalk.gray('  Generating updated content...'));
    const promptText = buildPrompt(projectInfo, language);
    
    const result = await model.generateContent([{ text: promptText }]);
    const response = await result.response;
    const newContent = response.text();

    if (!newContent) {
      throw new Error('Generated content is empty');
    }

    const processedNewContent = postProcessReadme(newContent);
    
    spinner.text = chalk.gray('  Merging with existing README...');
    
    let finalContent;
    
    if (updateChoice === 'selective') {
      // Update only selected sections
      finalContent = updateSpecificSections(
        readmeAnalysis.content,
        processedNewContent,
        sectionsToUpdate
      );
      
      spinner.succeed(chalk.green('  README sections updated'));
      console.log(chalk.gray(`  Updated sections: ${sectionsToUpdate.join(', ')}\n`));
    } else {
      // Full update with preservation
      finalContent = mergeReadmeContent(
        readmeAnalysis.content,
        processedNewContent,
        {
          preserveCustomSections: true,
          preserveHeader: false,
          sectionsToUpdate: []
        }
      );
      
      // Show diff summary
      const diff = createDiffSummary(readmeAnalysis.content, finalContent);
      
      spinner.succeed(chalk.green('  README updated'));
      
      if (diff.added.length > 0) {
        console.log(chalk.green(`  ✓ Added: ${diff.added.join(', ')}`));
      }
      if (diff.modified.length > 0) {
        console.log(chalk.yellow(`  ✓ Modified: ${diff.modified.join(', ')}`));
      }
      if (diff.removed.length > 0) {
        console.log(chalk.red(`  ✓ Removed: ${diff.removed.join(', ')}`));
      }
      console.log();
    }
    
    // Write updated README
    await fs.writeFile('README.md', finalContent);
    
    const stats = statSync('README.md');
    const fileSizeKB = (stats.size / 1024).toFixed(1);
    const lineCount = finalContent.split('\n').length;
    
    console.log(
      chalk.gray(`  ${lineCount} lines • ${fileSizeKB} KB • ${getLanguageName(language)}`) + '\n'
    );
    console.log(
      chalk.cyan('  ✨ Pro tip: ') +
      chalk.gray('Double-check your README at ') +
      chalk.blue.underline('https://readmi.jayanithu.dev/editor') + '\n'
    );
    
  } catch (error) {
    if (error.message.includes('not found for API version')) {
      throw new Error('API configuration error. Please check your API key and try again. Error: ' + error.message);
    }
    throw new Error(`README update failed: ${error.message}`);
  }
}

