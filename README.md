# ReadMI

Modern AI-powered README generator that analyzes your codebase and creates professional documentation automatically.

## Features

• **Smart Codebase Analysis** - Automatically analyzes your project structure and source code  
• **AI-Powered Generation** - Uses Google Gemini AI to generate comprehensive README files  
• **Multi-Language Support** - Generate READMEs in 10+ languages  
• **Project-Aware** - Extracts actual features and functionality from your code  
• **Modern & Clean** - Generates well-formatted, professional documentation  
• **Zero Configuration** - Works out of the box with minimal setup

## Installation

### Prerequisites

• Node.js (v14 or higher)  
• npm or yarn  
• Google AI API Key ([Get one here](https://makersuite.google.com/app/apikey))

### Step-by-Step Installation

1. **Install ReadMI globally:**

```bash
npm install -g @jayanithu/readmi
```

2. **Verify installation:**

```bash
readmi -v
```

You should see the version number displayed.

## Getting Your Google AI API Key

1. **Visit Google AI Studio:**
   - Go to [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)

2. **Sign in:**
   - Use your Google account to sign in

3. **Create API Key:**
   - Click "Create API Key"
   - Select or create a Google Cloud project
   - Copy your API key

4. **Save your API Key:**
   - When you first run `readmi`, you'll be prompted to enter your API key
   - Choose to save it for future use

**Note:** Keep your API key secure and never commit it to version control.

## Usage

### Generate README

Navigate to your project directory and run:

```bash
readmi
```
### Select Language

Generate README in a specific language:

```bash
readmi --select-language
```

Or use the short form:

```bash
readmi -sl
```

### Configuration

#### View Configuration

```bash
readmi config
```

#### Set Preferred Language

```bash
readmi config -l
```

#### Select Preferred Model

Choose your preferred AI model:

```bash
readmi config model
```

#### Remove Saved API Key

```bash
readmi config -r
```

#### Remove Preferred Model

```bash
readmi config -rm
```

#### Remove Preferred Language

```bash
readmi config -rl
```

## Commands Reference

### Main Commands

| Command | Description |
|---------|-------------|
| `readmi` | Generate README for current project |
| `readmi config` | Manage configuration |

### Options

| Option | Description |
|--------|-------------|
| `-v, --version` | Display version number |
| `-h, --help` | Show help information |
| `--update` | Update to latest version |
| `-sl, --select-language` | Select README language |

### Configuration Commands

| Command | Description |
|---------|-------------|
| `readmi config -r` | Remove saved API key |
| `readmi config -rm` | Remove preferred model |
| `readmi config -rl` | Remove preferred language |
| `readmi config -l` | Set preferred language |
| `readmi config model` | Select preferred AI model |

## Supported Languages

ReadMI supports generating READMEs in the following languages:

• English (en)  
• Spanish (es)  
• French (fr)  
• German (de)  
• Chinese (zh)  
• Japanese (ja)  
• Portuguese (pt)  
• Russian (ru)  
• Hindi (hi)  
• Arabic (ar)

## How It Works

1. **Project Analysis**
   - Scans your project directory
   - Reads package.json and configuration files
   - Analyzes source code structure
   - Detects dependencies and technologies

2. **Code Understanding**
   - Reads key source files
   - Extracts features and functionality
   - Identifies project type (CLI, library, web app, etc.)
   - Detects environment variables and configuration

3. **AI Generation**
   - Uses Google Gemini AI models
   - Generates comprehensive documentation
   - Includes relevant sections based on project type
   - Formats with proper markdown syntax

4. **Post-Processing**
   - Cleans and formats the output
   - Ensures proper code block formatting
   - Adds project-specific badges
   - Creates professional presentation

## Troubleshooting

### API Key Issues

If you encounter API key errors:

- Verify your API key is correct
- Check if the API key is saved: `readmi config`
- Remove and re-enter: `readmi config -r`
- Ensure you have internet connection

### Model Not Available

If a model is not available:

- ReadMI will automatically try the next available model
- Select a different model: `readmi config model`
- Ensure your API key has access to Gemini models

## Contributing

Contributions are welcome! Feel free to:

• Report bugs  
• Suggest new features  
• Submit pull requests  
• Improve documentation

Visit our [GitHub repository](https://github.com/jayanithu/readmi) to contribute.

## License

MIT License - see LICENSE file for details

## Support

• **GitHub Issues:** [Report issues](https://github.com/jayanithu/readmi/issues)  
• **readMI Landing Page:** [readmi.jayanithu.dev](https://readmi.jayanithu.dev/)  
• **Author:** [jayanithu](https://github.com/Jayanithu)

---