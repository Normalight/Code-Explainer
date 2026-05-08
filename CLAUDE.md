# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Code Explainer — a web app that helps developers understand unfamiliar codebases. Users upload a project zip, and the app provides AI-powered code explanation (split view with color-coded blocks), project structure analysis, and code quality assessment. See `docs/superpowers/specs/2026-05-08-code-explainer-design.md` for the full design.

## Build & Run Commands

### Backend (Spring Boot 3.3, Java 17, Maven)

```bash
cd backend
mvn spring-boot:run                  # Start backend on :8080
mvn test                             # Run all tests
mvn test -Dtest=ClassName            # Run single test class
mvn test -Dtest=ClassName#methodName # Run single test method
```

Requires: MySQL on localhost:3306 (DB: `code_explainer`), env vars `AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL`.

Tests use H2 in-memory DB (configured in `src/test/resources/application-test.yml`) and `ChatClient.Builder = null` to avoid Spring AI dependency in unit tests.

### Frontend (React 19, TypeScript, Vite)

```bash
cd frontend
npm run dev     # Dev server with proxy to backend :8080
npm run build   # Type-check + build
npx tsc --noEmit  # Type check only
```

Vite dev server proxies `/api` to `http://localhost:8080`.

## Architecture

### Backend — Two-Phase AI Pipeline

`ExplanationService` is the core. Code explanation is a two-phase pipeline:

1. **Segmentation** — LLM splits code into logical blocks via `buildSegmentationPrompt()` → returns `List<CodeSegment>`. If LLM fails or segments are invalid, `FallbackSegmenter` provides rule-based splitting (by blank lines + heuristic titles).
2. **Explanation** — For each segment, `buildExplanationPrompt()` generates a prompt with project context, and `explainSegment()` calls LLM synchronously.

Quality assessment uses `buildQualityAssessmentPrompt()` — separate from the explanation pipeline.

`CodeSegment` is a record with `fromJson()` (Jackson) and `validate()` (overlap/bounds checking). `ExplanationController` streams explanations via SSE (`segment_start` → `content` → `segment_end` events).

### Backend — File Upload Safety

`FileService.uploadZip()` streams the zip with `BufferedInputStream` (8KB buffer), not loading into memory. It enforces:
- 500MB zip limit, 10MB per extracted file
- Zip Slip protection via `isDangerousEntry()` (path traversal check)
- Skips 30+ binary extensions (video, model, archive files)
- `.normalize()` + `startsWith` double-check on resolved paths

### Frontend — Routing & Data Flow

- `/projects` — Upload page (no project ID)
- `/projects/:id` — Project overview (file tree sidebar + progress + structure analysis)
- `/projects/:id/files/*` — Code explanation view (left: explanation cards, right: syntax-highlighted code)

`src/api/index.ts` wraps all API calls. Upload uses `XMLHttpRequest` for progress tracking and abort support.

### Key Design Decisions

- `ExplanationService` constructor takes nullable `ChatClient.Builder` — allows unit testing without Spring context by passing `null`, which triggers fallback paths
- Controller tests use `@WebMvcTest` with `@MockBean` for all dependencies
- SSE endpoints return `Object` (either `ResponseEntity` for 404 or `SseEmitter`) because `{*filePath}` pattern can't be followed by more path segments
- Segment colors are assigned by index (`SEGMENT_COLORS[i % 10]`) and applied to both left explanation cards and right code line borders
