# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Aleph is a cataloguing and discovery tool for your ecosystem. Currently pre-alpha (
`0.0.0-pre_alpha.0`).

The core problem: large organizations have fragmented ecosystems with no single platform that cleanly organizes each part of the system, surfaces relationships between parts, and serves all stakeholder disciplines.

## Domain model

**Point
** — a distinct piece of the system: frontend component, backend service, framework, SDK, library, pipeline, test, test suite, etc. The fundamental unit of the catalog. (Name and system name both come from Borges'
*The Aleph*.)

**Domain
** — a product area with a distinct identity and focus, divorced from org structure. Domains contain Points. Example: at Home Depot, "Pro", "Major Appliances", and "Checkout" are domains (and sub-domains of "Online").

**Use case
** — a demonstrable, distinctly named behavior supported by a Point, with clearly defined inputs and outputs. Example: "when I click Previous, I navigate to the previous carousel item." Use cases can be version-specific.

**Connection
** — a directed relationship between two Points. Example: Component A depending on Component B creates a one-way dependency connection from A→B (and a corresponding dependent/consumer connection B→A).

**Version-specific
** — any concept (use case, connection, etc.) that applies to a specific published version of a Point rather than the Point as a whole.

## Stack

- TypeScript throughout (ESM modules, `"type": "module"` in package.json)
- Package manager: pnpm

**Frontend:** React, Vite, Tailwind CSS

- Tests: Vitest + React Testing Library

**Backend:** Fastify, postgres.js (Postgres)

- Tests: Vitest

**Infra:** Docker, Kubernetes

## Commands

[//]: # (We'll put the commands here when we have them)