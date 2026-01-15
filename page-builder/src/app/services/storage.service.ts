import { Injectable } from '@angular/core';
import { PageDocument, ProjectData } from '../models/page-schema';
import { STORAGE_KEY, deepClone } from '../utils/page-builder-utils';

@Injectable({ providedIn: 'root' })
export class StorageService {
  loadProjects(): ProjectData[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw) as ProjectData[];
    } catch {
      return [];
    }
  }

  saveProjects(projects: ProjectData[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  createProject(name: string): ProjectData {
    const now = Date.now();
    const project: ProjectData = {
      id: crypto.randomUUID?.() ?? `project-${Math.random().toString(36).slice(2, 10)}`,
      name,
      pages: [],
      createdAt: now,
      updatedAt: now,
    };
    const projects = this.loadProjects();
    projects.push(project);
    this.saveProjects(projects);
    return project;
  }

  addPage(projectId: string, page: PageDocument): void {
    const projects = this.loadProjects();
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      return;
    }
    project.pages.push(page);
    project.updatedAt = Date.now();
    this.saveProjects(projects);
  }

  updatePage(projectId: string, page: PageDocument): void {
    const projects = this.loadProjects();
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      return;
    }
    const index = project.pages.findIndex((item) => item.id === page.id);
    if (index === -1) {
      return;
    }
    project.pages[index] = deepClone(page);
    project.updatedAt = Date.now();
    this.saveProjects(projects);
  }

  deletePage(projectId: string, pageId: string): void {
    const projects = this.loadProjects();
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      return;
    }
    project.pages = project.pages.filter((item) => item.id !== pageId);
    project.updatedAt = Date.now();
    this.saveProjects(projects);
  }

  duplicatePage(projectId: string, pageId: string): PageDocument | null {
    const projects = this.loadProjects();
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      return null;
    }
    const original = project.pages.find((item) => item.id === pageId);
    if (!original) {
      return null;
    }
    const copy = deepClone(original);
    copy.id = crypto.randomUUID?.() ?? `page-${Math.random().toString(36).slice(2, 10)}`;
    copy.name = `${copy.name} Copy`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    project.pages.push(copy);
    project.updatedAt = Date.now();
    this.saveProjects(projects);
    return copy;
  }

  getPage(projectId: string, pageId: string): PageDocument | null {
    const projects = this.loadProjects();
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      return null;
    }
    const page = project.pages.find((item) => item.id === pageId);
    return page ? deepClone(page) : null;
  }

  getProject(projectId: string): ProjectData | null {
    const projects = this.loadProjects();
    const project = projects.find((item) => item.id === projectId);
    return project ? deepClone(project) : null;
  }
}
