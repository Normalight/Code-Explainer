# Code Explainer

AI-powered code explanation tool — upload a project, get instant, intelligent code analysis with a split-view interface.

## Features

- **On-demand AI analysis** — Click to analyze any file, streaming explanations in real time
- **Split-view interface** — Color-coded explanation cards on the left, syntax-highlighted code on the right
- **Smart segmentation** — LLM identifies meaningful code blocks, skips boilerplate and trivial code
- **Multi-language support** — Syntax highlighting and AST parsing for 15+ languages via tree-sitter
- **Project overview** — AI-generated project structure analysis with module breakdown
- **Dependency graph** — Interactive file dependency visualization with React Flow
- **Ask AI** — Select code and ask questions with streaming responses
- **Code search** — Find code across the entire project instantly
- **Git history** — Browse commits with AI-powered code review
- **Project chat** — Context-aware project-level conversation (RAG)
- **i18n** — Chinese and English UI with LLM output following locale preference

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Spring Boot 3.3, Java 17, Spring AI |
| Database | MySQL (metadata + cache) |
| AST | tree-sitter (Java bindings) |
| Graph | React Flow |
| AI | LLM via OpenAI-compatible API (configurable) |

## Prerequisites

- Java 17+
- Node.js 18+
- MySQL 8.0
- An OpenAI-compatible LLM API endpoint

## Getting Started

### Backend

```bash
cd backend
mvn spring-boot:run
```

Configure in `application.yml`:
- MySQL connection (`localhost:3306`, database: `code_explainer`)
- Environment variables: `AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8080`.

## How It Works

1. **Upload** a project zip file (or import from GitHub)
2. **Browse** the file tree to explore the project
3. **Analyze** any code file — the LLM segments it into meaningful blocks and explains each one
4. **Interact** — select code to ask questions, search across files, view dependencies

## License

[MIT](LICENSE)
