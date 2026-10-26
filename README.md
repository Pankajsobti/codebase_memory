# 🧠 Codebase Memory

**Understand any codebase without opening every file.**

Codebase Memory is a developer-focused tool that analyzes GitHub repositories and transforms their source code into an interactive, explorable graph. It helps developers understand code architecture, file dependencies, function calls, API routes, and relationships between different parts of a codebase.

Instead of manually navigating hundreds of files, developers can explore how a project is structured and ask questions about how its code works.

## ✨ Features

### 📊 Repository Analysis
- Analyze a GitHub repository using its URL.
- Clone and process repository source files.
- Extract imports, exports, functions, classes, and other code structures.
- Track repository analysis status.

### 🔗 Dependency Graph
- Visualize relationships between files and modules.
- Explore import dependencies across the codebase.
- Identify how different components connect.

### 🔍 Call Graph
- Visualize function-to-function calling relationships.
- Trace function calls across files.
- Understand how changes in one function may affect other parts of the application.

### 📁 Code Explorer
- Browse repository files.
- Inspect imports and exports.
- Explore functions and classes extracted from source code.
- View relevant code previews.

### 🏗️ Architecture Overview
- Generate a high-level summary of the repository.
- Understand the overall structure of an application.
- Identify important entry points and shared modules.

### 🛣️ API Routes and Data Models
- Explore API routes and their relationships with application components.
- Understand how backend routes interact with database models, where supported by the analyzed code.

### 💬 Codebase Q&A
- Ask questions about an analyzed repository using natural language.
- Receive answers based on the repository's available code context.
- Navigate relevant code structures to investigate answers.

## 🛠️ Tech Stack

### Frontend
- React.js
- Vite
- JavaScript
- React Flow for graph visualization, if configured in the implementation
- CSS

### Code Analysis
- Source-code parsing
- Import and export extraction
- Function and class identification
- Dependency graph construction
- Function call relationship analysis

### Backend and AI
The backend, repository-processing implementation, and AI integration should be documented according to the actual project configuration.

## ⚙️ How It Works

Codebase Memory follows a three-stage workflow:

**1. Clone and Ingest**

Provide a GitHub repository URL. The application retrieves and processes the repository's source files.

**2. Parse and Map**

The source code is analyzed to extract structural information, including imports, exports, functions, classes, and dependencies. These relationships are used to construct a graph of the codebase.

**3. Explore and Ask Questions**

Explore the dependency graph, inspect code structures, trace function calls, and ask questions about the repository.

## 📸 Screenshots

### Homepage
![Codebase Memory Homepage](screenshots/homepage.png)

### Homepage
![Codebase Memory OverView](screenshots/overview.png)

### Dependency Graph
![Dependency Graph](screenshots/dependency-graph.png)

### Call Graph
![Call Graph](screenshots/call-graph.png)

### Code Explorer
![Code Explorer](screenshots/code-explorer.png)

### Codebase Q&A
![Codebase Q&A](screenshots/codebase-qa.png)

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm
- Git
- Access to the repositories you want to analyze
- Any API keys required by the configured backend or AI provider

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_PROJECT_DIRECTORY>
```

### 2. Install Dependencies

```bash
npm install
```

If the project contains separate frontend and backend directories, install dependencies in each directory according to its `package.json`.

### 3. Configure Environment Variables

Create a `.env` file if required by the application.

Example:

```env
PORT=5000
GROQ_API_KEY=your_groq_api_key
```

Use only the environment variables required by your implementation. Never commit API keys, access tokens, or other secrets to GitHub.

### 4. Start the Application

For a Vite frontend, run:

```bash
npm run dev
```

If the backend runs separately, start it using the script defined in its `package.json`.

### 5. Open the Application

Open the local URL displayed in your terminal, commonly:

```text
http://localhost:5173
```

## 📂 Project Structure

The following is an illustrative structure. Update it to match the actual repository.

```text
codebase-memory/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── graph/
│   └── App.jsx
├── public/
├── package.json
├── vite.config.js
├── .gitignore
└── README.md
```

## 🎯 Use Cases

- Understanding unfamiliar repositories.
- Exploring large codebases.
- Learning how files and modules interact.
- Tracing function calls.
- Investigating API and database relationships.
- Onboarding new developers to an existing project.
- Exploring software architecture visually.

## 🔮 Future Improvements

- Support for additional programming languages.
- More accurate interprocedural call-graph analysis.
- Semantic code search.
- AI-assisted debugging and code explanations.
- Impact analysis for code changes.
- Repository comparison and change visualization.
- GitHub pull-request integration.
- Automated testing and deployment.

## 🔐 Security Considerations

- Never expose API keys or repository access tokens.
- Avoid logging sensitive source code or credentials.
- Respect repository permissions and access restrictions.
- Do not assume private repositories are publicly accessible.
- Review repository-processing permissions before analyzing sensitive projects.

## 🤝 Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request describing your improvements.

## 📄 License

Add an appropriate license before distributing the project.

---

**Codebase Memory — Explore the connections. Understand the code.**