import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { config } from './config.js';

export const AVAILABLE_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash-8b-latest',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.5-pro-preview-05-06'
];

export async function selectModel(apiKey, spinner) {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const savedModel = config.get('preferredModel');
  if (savedModel && AVAILABLE_MODELS.includes(savedModel)) {
    try {
      const model = genAI.getGenerativeModel({
        model: savedModel,
        generationConfig: {
          temperature: savedModel.includes('flash') ? 0.8 : 0.7,
          maxOutputTokens: savedModel.includes('pro') ? 4096 : 2048,
          topP: savedModel.includes('flash') ? 0.9 : 0.8,
          topK: savedModel.includes('pro') ? 40 : 32
        }
      });
      await model.generateContent([{ text: 'test' }]);
      spinner.succeed(chalk.green(`  Using ${chalk.bold(savedModel)}`));
      return model;
    } catch (error) {
      spinner.warn(chalk.gray(`  Saved model ${savedModel} not available, trying defaults...`));
    }
  }
  
  const preferredModels = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash-8b'
  ];
  
  let selectedModel = null;
  let workingModel = null;

  for (const modelName of preferredModels) {
    if (!AVAILABLE_MODELS.includes(modelName)) continue;
    
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
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048,
        topP: 0.9,
        topK: 32
      }
    });
    selectedModel = 'gemini-1.5-flash';
  }

  const modelType = selectedModel?.toLowerCase() || '';
  if (modelType.includes('2.5')) {
    spinner.stopAndPersist({
      symbol: chalk.cyan('→'),
      text: chalk.white('Model: ') + chalk.cyan.bold('Gemini 2.5')
    });
  } else if (modelType.includes('2.0')) {
    spinner.stopAndPersist({
      symbol: chalk.cyan('→'),
      text: chalk.white('Model: ') + chalk.cyan.bold('Gemini 2.0')
    });
  } else if (modelType.includes('1.5')) {
    spinner.stopAndPersist({
      symbol: chalk.cyan('→'),
      text: chalk.white('Model: ') + chalk.cyan.bold('Gemini 1.5')
    });
  }

  return workingModel;
}

export async function chooseModel(spinner) {
  const savedModel = config.get('preferredModel');
  
  spinner.stop();
  console.log('\n' + chalk.bold.white('Model Selection') + '\n');
  
  const { model } = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: chalk.cyan('  Select a model:'),
      choices: AVAILABLE_MODELS.map(m => ({
        name: m,
        value: m
      })),
      default: savedModel && AVAILABLE_MODELS.includes(savedModel) 
        ? AVAILABLE_MODELS.indexOf(savedModel) 
        : AVAILABLE_MODELS.indexOf('gemini-2.0-flash'),
      pageSize: 12
    }
  ]);
  
  const { saveModel } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveModel',
      message: chalk.gray('  Save as preferred model?'),
      default: true
    }
  ]);
  
  if (saveModel) {
    config.set('preferredModel', model);
    spinner.succeed(chalk.green(`  Model saved: ${model}`));
  } else {
    spinner.succeed(chalk.green(`  Selected: ${model}`));
  }
  
  return model;
}

