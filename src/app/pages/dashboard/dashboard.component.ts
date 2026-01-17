import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProjectData } from '../../models/page-schema';
import { createPageDocument } from '../../utils/page-builder-utils';
import { ProjectsService } from '../../services/projects.service';
import { PagesService } from '../../services/pages.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { combineLatest, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  projects: ProjectData[] = [];
  projectName = '';
  projectNameError = '';
  editingProjectId: string | null = null;
  projectNameEdits: Record<string, string> = {};
  projectEditErrors: Record<string, string> = {};
  pageNameByProject: Record<string, string> = {};
  pageNameErrors: Record<string, string> = {};
  loading = true;
  userEmail = '';
  actionLoading = false;
  actionMessage = 'Working...';
  private unsubscribe?: () => void;
  private authSub?: Subscription;

  constructor(
    private projectsService: ProjectsService,
    private pagesService: PagesService,
    private router: Router,
    private auth: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.authSub = combineLatest([this.auth.ready$, this.auth.user$])
      .pipe(filter(([ready]) => ready))
      .subscribe(([, user]) => {
        if (!user) {
          this.router.navigate(['/login']);
          return;
        }
        this.unsubscribe?.();
        this.loading = true;
        this.userEmail = user.email ?? '';
        const cached = this.projectsService.getCachedProjects();
        if (cached) {
          this.projects = cached;
          this.loading = false;
        }
        this.unsubscribe = this.projectsService.subscribeProjects(
          (projects) => {
            this.projects = projects;
            this.loading = false;
          },
          (error) => {
            this.toast.show(error.message, 'error');
            this.loading = false;
          },
        );
      });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    this.authSub?.unsubscribe();
  }

  async createProject(): Promise<void> {
    if (this.actionLoading) {
      return;
    }
    if (!this.projectName.trim()) {
      this.projectNameError = 'Project name is required.';
      this.toast.show('Project name is required.', 'error');
      return;
    }
    this.projectNameError = '';
    this.setActionLoading(true, 'Creating project...');
    try {
      const project = await this.projectsService.createProject(this.projectName.trim());
      this.projectName = '';
      this.projects = this.projectsService.normalizeProjects([project, ...this.projects]);
      this.projectsService.setCachedProjects(this.projects);
    } catch (err) {
      this.toast.show(this.getErrorMessage(err), 'error');
    } finally {
      this.setActionLoading(false);
    }
  }

  async createPage(projectId: string): Promise<void> {
    if (this.actionLoading) {
      return;
    }
    const name = this.pageNameByProject[projectId]?.trim();
    if (!name) {
      this.pageNameErrors[projectId] = 'Page name is required.';
      this.toast.show('Page name is required.', 'error');
      return;
    }
    const targetProject = this.projects.find((project) => project.id === projectId);
    if (
      targetProject?.pages.some(
        (page) => page.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      this.pageNameErrors[projectId] = 'Page name already exists.';
      this.toast.show('Page name already exists.', 'error');
      return;
    }
    this.pageNameErrors[projectId] = '';
    const page = createPageDocument(name);
    this.setActionLoading(true, 'Creating page...');
    try {
      await this.pagesService.addPage(projectId, page);
      this.pageNameByProject[projectId] = '';
      this.projects = this.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }
        return {
          ...project,
          pages: [...project.pages, page],
          updatedAt: Date.now(),
        };
      });
      this.projects = this.projectsService.normalizeProjects(this.projects);
      this.projectsService.setCachedProjects(this.projects);
    } catch (err) {
      this.toast.show(this.getErrorMessage(err), 'error');
    } finally {
      this.setActionLoading(false);
    }
  }

  openBuilder(projectId: string, pageId: string): void {
    this.router.navigate(['/builder', projectId, pageId]);
  }

  async duplicatePage(projectId: string, pageId: string): Promise<void> {
    if (this.actionLoading) {
      return;
    }
    this.setActionLoading(true, 'Duplicating page...');
    try {
      const duplicated = await this.pagesService.duplicatePage(projectId, pageId);
      if (duplicated) {
        this.projects = this.projects.map((project) => {
          if (project.id !== projectId) {
            return project;
          }
          return {
            ...project,
            pages: [...project.pages, duplicated],
            updatedAt: Date.now(),
          };
        });
        this.projects = this.projectsService.normalizeProjects(this.projects);
        this.projectsService.setCachedProjects(this.projects);
      }
    } catch (err) {
      this.toast.show(this.getErrorMessage(err), 'error');
    } finally {
      this.setActionLoading(false);
    }
  }

  async deletePage(projectId: string, pageId: string): Promise<void> {
    if (this.actionLoading) {
      return;
    }
    if (!confirm('Delete this page?')) {
      return;
    }
    this.setActionLoading(true, 'Deleting page...');
    try {
      await this.pagesService.deletePage(projectId, pageId);
      this.projects = this.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }
        return {
          ...project,
          pages: project.pages.filter((page) => page.id !== pageId),
          updatedAt: Date.now(),
        };
      });
      this.projects = this.projectsService.normalizeProjects(this.projects);
      this.projectsService.setCachedProjects(this.projects);
    } catch (err) {
      this.toast.show(this.getErrorMessage(err), 'error');
    } finally {
      this.setActionLoading(false);
    }
  }

  async logout(): Promise<void> {
    this.setActionLoading(true, 'Signing out...');
    try {
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } catch (err) {
      this.toast.show(this.getErrorMessage(err), 'error');
    } finally {
      this.setActionLoading(false);
    }
  }

  manageProfile(): void {
    this.toast.show('Profile management is coming soon.', 'info');
  }

  startEditProject(project: ProjectData): void {
    this.editingProjectId = project.id;
    this.projectNameEdits[project.id] = project.name;
    this.projectEditErrors[project.id] = '';
  }

  cancelEditProject(): void {
    this.editingProjectId = null;
  }

  async saveProjectName(projectId: string): Promise<void> {
    if (this.actionLoading) {
      return;
    }
    const name = this.projectNameEdits[projectId]?.trim();
    if (!name) {
      this.projectEditErrors[projectId] = 'Project name is required.';
      return;
    }
    this.projectEditErrors[projectId] = '';
    this.setActionLoading(true, 'Updating project...');
    try {
      await this.projectsService.updateProjectName(projectId, name);
      this.projects = this.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              name,
              updatedAt: Date.now(),
            }
          : project,
      );
      this.projectsService.setCachedProjects(this.projects);
      this.editingProjectId = null;
    } catch (err) {
      this.toast.show(this.getErrorMessage(err), 'error');
    } finally {
      this.setActionLoading(false);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    if (!confirm('Delete this project and all its pages?')) {
      return;
    }
    this.setActionLoading(true, 'Deleting project...');
    try {
      await this.projectsService.deleteProject(projectId);
      this.projects = this.projects.filter((project) => project.id !== projectId);
      this.projectsService.setCachedProjects(this.projects);
    } catch (err) {
      this.toast.show(this.getErrorMessage(err), 'error');
    } finally {
      this.setActionLoading(false);
    }
  }

  onProjectNameChange(value: string): void {
    if (value.trim()) {
      this.projectNameError = '';
    }
  }

  onProjectEditChange(projectId: string, value: string): void {
    if (value.trim()) {
      this.projectEditErrors[projectId] = '';
    }
  }

  onPageNameChange(projectId: string, value: string): void {
    if (value.trim()) {
      this.pageNameErrors[projectId] = '';
    }
  }

  private setActionLoading(isLoading: boolean, message?: string): void {
    this.actionLoading = isLoading;
    if (message) {
      this.actionMessage = message;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Something went wrong. Please try again.';
  }

  trackByProjectId(_: number, project: ProjectData): string {
    return project.id;
  }

  trackByPageId(_: number, page: { id: string }): string {
    return page.id;
  }
}
