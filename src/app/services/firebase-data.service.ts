import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  getFirestore,
  enableIndexedDbPersistence,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { firebaseApp } from '../firebase/firebase-init';
import { PageDocument, ProjectData } from '../models/page-schema';
import { AuthService } from './auth.service';
import { deepClone, generateId } from '../utils/page-builder-utils';

@Injectable({ providedIn: 'root' })
export class FirebaseDataService {
  private db = getFirestore(firebaseApp);
  private static readonly WRITE_TIMEOUT_MS = 40000;

  constructor(private auth: AuthService) {
    enableIndexedDbPersistence(this.db).catch(() => {
      // Ignore persistence errors (e.g., multiple tabs).
    });
  }

  async listProjects(): Promise<ProjectData[]> {
    const uid = this.getUidOrThrow();
    const projectsSnap = await getDocs(collection(this.db, `users/${uid}/projects`));
    const projects: ProjectData[] = [];
    for (const projectDoc of projectsSnap.docs) {
      const pagesSnap = await getDocs(collection(this.db, `users/${uid}/projects/${projectDoc.id}/pages`));
      const pages = pagesSnap.docs.map((pageDoc) => this.deserializePage(pageDoc.id, pageDoc.data()));
      projects.push({
        id: projectDoc.id,
        name: projectDoc.data()['name'] ?? 'Untitled',
        pages,
        createdAt: projectDoc.data()['createdAt'] ?? Date.now(),
        updatedAt: projectDoc.data()['updatedAt'] ?? Date.now(),
      });
    }
    return projects;
  }

  subscribeProjects(
    onChange: (projects: ProjectData[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const uid = this.getUidOrThrow();
    const projectsMap = new Map<string, ProjectData>();
    const pageUnsubs = new Map<string, () => void>();

    const emit = () => {
      onChange(
        Array.from(projectsMap.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
      );
    };

    const unsubProjects = onSnapshot(
      collection(this.db, `users/${uid}/projects`),
      (snapshot) => {
        const currentIds = new Set<string>();

        snapshot.docs.forEach((projectDoc) => {
          const data = projectDoc.data();
          const existing = projectsMap.get(projectDoc.id);
          const project: ProjectData = existing ?? {
            id: projectDoc.id,
            name: data['name'] ?? 'Untitled',
            pages: [],
            createdAt: data['createdAt'] ?? Date.now(),
            updatedAt: data['updatedAt'] ?? Date.now(),
          };

          project.name = data['name'] ?? project.name;
          project.createdAt = data['createdAt'] ?? project.createdAt;
          project.updatedAt = data['updatedAt'] ?? project.updatedAt;

          projectsMap.set(projectDoc.id, project);
          currentIds.add(projectDoc.id);

          if (!pageUnsubs.has(projectDoc.id)) {
            const unsubPages = onSnapshot(
              collection(this.db, `users/${uid}/projects/${projectDoc.id}/pages`),
              (pagesSnap) => {
                const pages = pagesSnap.docs.map((pageDoc) =>
                  this.deserializePage(pageDoc.id, pageDoc.data()),
                );
                const target = projectsMap.get(projectDoc.id);
                if (target) {
                  target.pages = pages;
                  emit();
                }
              },
              (error) => {
                onError?.(error);
              },
            );
            pageUnsubs.set(projectDoc.id, unsubPages);
          }
        });

        Array.from(projectsMap.keys()).forEach((id) => {
          if (!currentIds.has(id)) {
            projectsMap.delete(id);
            const unsub = pageUnsubs.get(id);
            if (unsub) {
              unsub();
            }
            pageUnsubs.delete(id);
          }
        });

        emit();
      },
      (error) => {
        onError?.(error);
      },
    );

    return () => {
      unsubProjects();
      pageUnsubs.forEach((unsub) => unsub());
      pageUnsubs.clear();
      projectsMap.clear();
    };
  }

  async createProject(name: string): Promise<ProjectData> {
    const uid = this.getUidOrThrow();
    const now = Date.now();
    const projectRef = await this.withTimeout(
      addDoc(collection(this.db, `users/${uid}/projects`), {
        name,
        createdAt: now,
        updatedAt: now,
      }),
      'Create project',
    );
    return {
      id: projectRef.id,
      name,
      pages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateProjectName(projectId: string, name: string): Promise<void> {
    const uid = this.getUidOrThrow();
    await this.withTimeout(
      updateDoc(doc(this.db, `users/${uid}/projects/${projectId}`), { name, updatedAt: Date.now() }),
      'Update project',
    );
  }

  async deleteProject(projectId: string): Promise<void> {
    const uid = this.getUidOrThrow();
    const pagesSnap = await getDocs(collection(this.db, `users/${uid}/projects/${projectId}/pages`));
    for (const pageDoc of pagesSnap.docs) {
      await this.deleteCollectionDocs(
        `users/${uid}/projects/${projectId}/pages/${pageDoc.id}/versions`,
      );
      await this.withTimeout(deleteDoc(pageDoc.ref), 'Delete page');
    }
    await this.withTimeout(deleteDoc(doc(this.db, `users/${uid}/projects/${projectId}`)), 'Delete project');
  }

  async addPage(projectId: string, page: PageDocument): Promise<void> {
    const uid = this.getUidOrThrow();
    const pageRef = doc(this.db, `users/${uid}/projects/${projectId}/pages/${page.id}`);
    await this.withTimeout(
      setDoc(pageRef, { ...page, createdAt: page.createdAt, updatedAt: page.updatedAt }),
      'Create page',
    );
    await this.withTimeout(
      updateDoc(doc(this.db, `users/${uid}/projects/${projectId}`), { updatedAt: Date.now() }),
      'Update project timestamp',
    );
  }

  async updatePage(projectId: string, page: PageDocument): Promise<void> {
    const uid = this.getUidOrThrow();
    const pageRef = doc(this.db, `users/${uid}/projects/${projectId}/pages/${page.id}`);
    await this.withTimeout(
      setDoc(pageRef, { ...page, updatedAt: page.updatedAt }, { merge: true }),
      'Update page',
    );
    await this.withTimeout(
      updateDoc(doc(this.db, `users/${uid}/projects/${projectId}`), { updatedAt: Date.now() }),
      'Update project timestamp',
    );
  }

  async deletePage(projectId: string, pageId: string): Promise<void> {
    const uid = this.getUidOrThrow();
    await this.withTimeout(
      deleteDoc(doc(this.db, `users/${uid}/projects/${projectId}/pages/${pageId}`)),
      'Delete page',
    );
    await this.withTimeout(
      updateDoc(doc(this.db, `users/${uid}/projects/${projectId}`), { updatedAt: Date.now() }),
      'Update project timestamp',
    );
  }

  async duplicatePage(projectId: string, pageId: string): Promise<PageDocument | null> {
    const page = await this.getPage(projectId, pageId);
    if (!page) {
      return null;
    }
    const copy = deepClone(page);
    copy.id = generateId();
    copy.name = `${copy.name} Copy`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    await this.addPage(projectId, copy);
    return copy;
  }

  async getPage(projectId: string, pageId: string): Promise<PageDocument | null> {
    const uid = this.getUidOrThrow();
    const pageSnap = await getDoc(doc(this.db, `users/${uid}/projects/${projectId}/pages/${pageId}`));
    if (!pageSnap.exists()) {
      return null;
    }
    return this.deserializePage(pageSnap.id, pageSnap.data());
  }

  async getProject(projectId: string): Promise<ProjectData | null> {
    const uid = this.getUidOrThrow();
    const projectSnap = await getDoc(doc(this.db, `users/${uid}/projects/${projectId}`));
    if (!projectSnap.exists()) {
      return null;
    }
    const pagesSnap = await getDocs(collection(this.db, `users/${uid}/projects/${projectId}/pages`));
    const pages = pagesSnap.docs.map((pageDoc) => this.deserializePage(pageDoc.id, pageDoc.data()));
    return {
      id: projectId,
      name: projectSnap.data()['name'] ?? 'Untitled',
      pages,
      createdAt: projectSnap.data()['createdAt'] ?? Date.now(),
      updatedAt: projectSnap.data()['updatedAt'] ?? Date.now(),
    };
  }

  async addVersion(projectId: string, pageId: string, page: PageDocument, note: string): Promise<void> {
    const uid = this.getUidOrThrow();
    await addDoc(collection(this.db, `users/${uid}/projects/${projectId}/pages/${pageId}/versions`), {
      createdAt: Date.now(),
      note,
      schemaSnapshot: page,
    });
  }

  async getNextVersionNumber(projectId: string, pageId: string): Promise<number> {
    const uid = this.getUidOrThrow();
    const versionsSnap = await getDocs(
      collection(this.db, `users/${uid}/projects/${projectId}/pages/${pageId}/versions`),
    );
    return versionsSnap.size + 1;
  }

  async listVersions(projectId: string, pageId: string): Promise<{ id: string; createdAt: number; note: string }[]> {
    const uid = this.getUidOrThrow();
    const versionsSnap = await getDocs(
      collection(this.db, `users/${uid}/projects/${projectId}/pages/${pageId}/versions`),
    );
    return versionsSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      createdAt: docSnap.data()['createdAt'] ?? Date.now(),
      note: docSnap.data()['note'] ?? '',
    }));
  }

  async getVersionSnapshot(projectId: string, pageId: string, versionId: string): Promise<PageDocument | null> {
    const uid = this.getUidOrThrow();
    const snap = await getDoc(
      doc(this.db, `users/${uid}/projects/${projectId}/pages/${pageId}/versions/${versionId}`),
    );
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data()['schemaSnapshot'];
    if (!data) {
      return null;
    }
    return this.deserializePage(data['id'] ?? pageId, data);
  }

  private getUidOrThrow(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }
    return uid;
  }

  private deserializePage(id: string, data: Record<string, unknown>): PageDocument {
    const page = data as unknown as PageDocument;
    return {
      ...page,
      id,
      root: page.root,
      settings: page.settings,
      createdAt: page.createdAt ?? Date.now(),
      updatedAt: page.updatedAt ?? Date.now(),
    };
  }

  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`${label} timed out. Please try again.`));
          }, FirebaseDataService.WRITE_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async deleteCollectionDocs(path: string): Promise<void> {
    const snap = await getDocs(collection(this.db, path));
    const docs = snap.docs;
    const chunkSize = 400;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const batch = writeBatch(this.db);
      docs.slice(i, i + chunkSize).forEach((docRef) => {
        batch.delete(docRef.ref);
      });
      await this.withTimeout(batch.commit(), 'Delete collection');
    }
  }
}
