import { Injectable } from '@angular/core';
import { FirebaseDataService } from './firebase-data.service';
import { ProjectData } from '../models/page-schema';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private cachedProjects: ProjectData[] | null = null;
  private cachedUid: string | null = null;

  constructor(private dataService: FirebaseDataService, private auth: AuthService) {}

  getCachedProjects(): ProjectData[] | null {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      return null;
    }
    if (this.cachedProjects && this.cachedUid === uid) {
      return this.cachedProjects;
    }
    const raw = localStorage.getItem(this.getCacheKey(uid));
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as ProjectData[];
      const normalized = this.normalizeProjects(parsed);
      this.cachedProjects = normalized;
      this.cachedUid = uid;
      return normalized;
    } catch {
      return null;
    }
  }

  setCachedProjects(projects: ProjectData[]): void {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      return;
    }
    const normalized = this.normalizeProjects(projects);
    this.cachedProjects = normalized;
    this.cachedUid = uid;
    localStorage.setItem(this.getCacheKey(uid), JSON.stringify(normalized));
  }

  listProjects(): Promise<ProjectData[]> {
    return this.dataService.listProjects();
  }

  normalizeProjects(projects: ProjectData[]): ProjectData[] {
    const uniqueProjects = new Map<string, ProjectData>();
    projects.forEach((project) => {
      const existing = uniqueProjects.get(project.id);
      if (!existing || (project.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
        uniqueProjects.set(project.id, project);
      }
    });
    return Array.from(uniqueProjects.values()).map((project) => {
      const uniquePages = new Map<string, ProjectData['pages'][number]>();
      project.pages.forEach((page) => {
        const existing = uniquePages.get(page.id);
        if (!existing || (page.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
          uniquePages.set(page.id, page);
        }
      });
      return {
        ...project,
        pages: Array.from(uniquePages.values()),
      };
    });
  }

  subscribeProjects(
    onChange: (projects: ProjectData[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return this.dataService.subscribeProjects(
      (projects) => {
        const normalized = this.normalizeProjects(projects);
        this.setCachedProjects(normalized);
        onChange(normalized);
      },
      onError,
    );
  }

  createProject(name: string): Promise<ProjectData> {
    return this.dataService.createProject(name);
  }

  updateProjectName(projectId: string, name: string): Promise<void> {
    return this.dataService.updateProjectName(projectId, name);
  }

  deleteProject(projectId: string): Promise<void> {
    return this.dataService.deleteProject(projectId);
  }

  getProject(projectId: string): Promise<ProjectData | null> {
    return this.dataService.getProject(projectId);
  }

  private getCacheKey(uid: string): string {
    return `page_builder_projects_cache_${uid}`;
  }
}
