# Angular Page Builder (Part-2)

This repository contains the **Part-2** implementation of a standalone Angular 18 Page Builder. The project uses routing, SCSS, Firebase Auth + Firestore + Storage persistence, and includes the builder UI, preview, export, backup/restore, undo/redo, image uploads, and version snapshots.

## Getting Started

```bash
npm install
npm start
```

The app will run at `http://localhost:4200`.

## Routes

- `/login` – email/password login or register.
- `/dashboard` – create projects and pages, duplicate or delete pages, open the builder or preview (auth required).
- `/builder/:projectId/:pageId` – main editor with component library, canvas, and properties panel.
- `/preview/:projectId/:pageId` – full-page preview (no editor UI).

## How to Use the Builder

1. **Login/Register** from `/login`.
2. **Create a project** on the dashboard.
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

## Keyboard Shortcuts

- `Cmd/Ctrl + Z` – Undo
- `Cmd/Ctrl + Shift + Z` or `Ctrl + Y` – Redo
- `Delete` or `Cmd + Backspace` – Delete selected node

## Firebase Setup

Firebase is initialized in `src/app/firebase/firebase-init.ts` with the provided configuration.

Data model:

- `users/{uid}/projects/{projectId}`
- `users/{uid}/projects/{projectId}/pages/{pageId}`
- `users/{uid}/projects/{projectId}/pages/{pageId}/versions/{versionId}`

Images are stored under:

- `users/{uid}/projects/{projectId}/images/{uuid}`

## Verification Steps

1. `npm install`
2. `npm start`
3. Register a new user at `/login`.
4. Create a project + page in `/dashboard`.
5. Edit a page, click **Save**, refresh the browser, confirm the data persists.
6. Upload an image in the Image block, confirm it renders.
7. Export static HTML/CSS or Angular component, confirm the zip downloads.
8. Export (creates version snapshot), open **Versions**, restore a version.
9. Confirm there are no console errors.

## Notes

- Firebase Auth protects `/dashboard`, `/builder`, and `/preview`.
- Pure HTML + custom SCSS (no UI frameworks).
- Undo/redo history keeps the last 50 snapshots.
