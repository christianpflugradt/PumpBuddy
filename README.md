# PumpBuddy

PumpBuddy is a personal training companion designed to support structured strength training in the gym.
The project focuses on simplicity, clarity, and long‑term maintainability while providing a smooth training workflow during workouts.

## Product Idea

PumpBuddy helps a single user manage workout plans and record training sessions with minimal friction.
The application guides the user through exercises during a workout and keeps track of weights, variations, and progress over time.

Core principles:

- fast interaction during workouts
- minimal manual input
- clear structure of training plans and exercises
- reliable tracking of training data

PumpBuddy is intentionally designed as a personal tool rather than a social or commercial fitness platform.

## Architecture Overview

PumpBuddy follows a simple service-oriented architecture consisting of three components:

- Renderer (Web Application) – serves the user interface and communicates with the backend
- Backend Service – implements application logic and the API
- Database – stores plans, exercises, sessions, and related data

Only the renderer is exposed to the internet.
Backend and database services communicate internally within the container environment.

## Technology Stack

The project uses a deliberately small and stable technology stack.

- Frontend: TypeScript-based web application using Web Components
- Backend: Rust-based API service
- Database: PostgreSQL
- Deployment: containerized services

The stack prioritizes long-term maintainability, performance, and clear system boundaries.

## AI‑Assisted Development

PumpBuddy is developed using an AI-assisted workflow.

Plans and product direction are defined by the project owner.
AI agents support the development process through:

- backlog refinement
- implementation of tasks
- structured reviews and consistency checks

The workflow is task-based (not role-based): each task run starts with fresh context and derives behavior from the invoked task.

Fresh context is especially important when switching perspective between tasks (for example implementation to review) to avoid carry-over bias and reduce review errors.

This approach combines human architectural control with AI-assisted productivity.

## Project Status

PumpBuddy is in early development and evolves incrementally through small plans.
The core system architecture is established first while the domain model grows step by step.

## License

PumpBuddy is released under the **PolyForm Noncommercial License 1.0.0**.

The software may be used for personal and non-commercial purposes.
Commercial use is not permitted without explicit permission from the licensor.
