import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import gradient from 'gradient-string';

export async function selectModel(apiKey, spinner) {
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
          temperature: modelName.includes('flash') ? 0.8 : 0.7,
          maxOutputTokens: modelName.includes('pro') ? 4096 : 2048,
          topP: modelName.includes('flash') ? 0.9 : 0.8,
          topK: modelName.includes('pro') ? 40 : 32
        }
      });
      await tempModel.generateContent([{ text: 'test' }]);
      workingModel = tempModel;
      selectedModel = modelName;
      spinner.succeed(chalk.green(`  Using ${chalk.bold(modelName)}`));
      break;
    } catch (error) {
      spinner.warn(chalk.gray(`  ${modelName} not available, trying next...`));
      continue;
    }
  }

  if (!workingModel || !selectedModel) {
    workingModel = genAI.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.8,
        topK: 32
      }
    });
  }

  const modelType = selectedModel?.toLowerCase() || '';
  if (modelType.includes('2.0')) {
    spinner.info(chalk.gray('  Using Gemini 2.0'));
  } else if (modelType.includes('1.5')) {
    spinner.info(chalk.gray('  Using Gemini 1.5'));
  } else if (modelType.includes('flash')) {
    spinner.info(chalk.gray('  Using Flash model'));
  }

  return workingModel;
}

export async function listAvailableModels(apiKey) {
  const spinner = ora({
    text: chalk.gray('  Fetching models...'),
    spinner: 'dots'
  }).start();
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelList = await genAI.listModels();
    spinner.succeed(chalk.green('  Models fetched'));
    
    const models = modelList.models.map(
      (model, index) =>
        chalk.cyan(`  ${String(index + 1).padStart(2, ' ')}. ${model.name}`) +
        (model.description ? `\n     ${chalk.gray(model.description)}` : chalk.gray('\n     No description'))
    ).join('\n\n');
    
    console.log(
      '\n' +
      chalk.bold('  Available Models\n') +
      '\n' +
      models +
      '\n' +
      chalk.gray(`  Total: ${modelList.models.length} models\n`)
    );
  } catch (error) {
    spinner.fail(chalk.red('  Failed: ') + error.message);
    process.exit(1);
  }
}

