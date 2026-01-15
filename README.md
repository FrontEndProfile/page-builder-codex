# Angular Page Builder (Part-1)

This repository contains the **Part-1** implementation of a standalone Angular 17 Page Builder. The project uses routing, SCSS, LocalStorage persistence, and includes the builder UI, preview, export, backup/restore, and undo/redo.

## Getting Started

```bash
cd page-builder
npm install
npm start
```

The app will run at `http://localhost:4200`.

## Routes

- `/dashboard` – create projects and pages, duplicate or delete pages, open the builder or preview.
- `/builder/:projectId/:pageId` – main editor with component library, canvas, and properties panel.
- `/preview/:projectId/:pageId` – full-page preview (no editor UI).

## How to Use the Builder

1. **Create a project** on the dashboard.
2. **Create a page** under the project.
3. Open the **Builder** to start adding blocks.
4. Click items in the **Component Library** to add nodes to the selected container (or the root if none selected).
5. Click a node on the canvas to edit its properties in the right panel.
6. Use **Undo/Redo** and **Save** in the top bar.

## Exporting

The **Export** button produces a zip file using JSZip with one of these formats:

- **Static HTML + CSS**
  - `index.html` – rendered markup.
  - `styles.css` – base styles + node styles + hover styles.

- **Angular Component**
  - `page.component.html` – rendered markup.
  - `page.component.scss` – base styles + node styles + hover styles.
  - `page.component.ts` – minimal standalone component.

## Backup / Restore

- **Export JSON** downloads the current `PageDocument` as JSON.
- **Import JSON** replaces the current page with the uploaded JSON (validated against the expected schema).

## Notes

- Uses LocalStorage for persistence (no Firebase in Part-1).
- Pure HTML + custom SCSS (no UI frameworks).
- Undo/redo history keeps the last 50 snapshots.
