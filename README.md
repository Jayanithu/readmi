# readmi

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

`readmi` is a modern, AI-powered command-line tool that helps you generate and update README files for your projects. It analyzes your project's source code and generates a comprehensive and informative README, saving you time and effort. Version: 2.4.5

## ✨ Features

*   ⚡️ **AI-Powered Generation:** Generates README content based on project analysis using Google's Gemini AI models.
*   🚀 **Automatic Project Analysis:** Analyzes project structure, dependencies, and code to extract relevant information.
*   🌐 **Multi-Language Support:** Generates READMEs in multiple languages, including English, Spanish, French, and more.
*   🔄 **README Updating:** Detects outdated information in existing READMEs and suggests updates.
*   ⚙️ **Configuration:** Allows users to configure API keys, preferred AI models, and languages.

## 📦 Installation

To install `readmi` globally, run:

```bash
npm install -g @jayanithu/readmi
```

## 🚀 Usage/Quick Start

To generate a README for your project, navigate to your project's root directory in the terminal and run:

```bash
readmi
```

To update an existing README, use the `--update-readme` or `-u` flag:

```bash
readmi --update-readme
```

You can also configure `readmi` using the `config` command:

```bash
readmi config
```

This will guide you through setting up your Google AI API key and preferred language.

To select a language:

```bash
readmi language
```

## ⚙️ Configuration

`readmi` stores its configuration in a `config.json` file. You can configure the following:

*   **Google AI API Key:** Required to use the AI-powered generation.
*   **Preferred AI Model:** Select from available Gemini models.
*   **Preferred Language:** The language in which to generate the README.

## 📜 Scripts/Commands

The `package.json` file includes the following script:

*   `start`: Starts the `readmi` tool.

## Contributing

Contributions are welcome! Feel free to submit pull requests or open issues for bug fixes, feature requests, or improvements.

## License

MIT License

---

**Made with ❤️ using [ReadMI](https://github.com/jayanithu/readmi) by jayanithu**
