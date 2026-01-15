import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { ProjectData } from '../../models/page-schema';
import { createPageDocument } from '../../utils/page-builder-utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  projects: ProjectData[] = [];
  projectName = '';
  pageNameByProject: Record<string, string> = {};

  constructor(private storage: StorageService, private router: Router) {
    this.refresh();
  }

  refresh(): void {
    this.projects = this.storage.loadProjects();
  }

  createProject(): void {
    if (!this.projectName.trim()) {
      return;
    }
    this.storage.createProject(this.projectName.trim());
    this.projectName = '';
    this.refresh();
  }

  createPage(projectId: string): void {
    const name = this.pageNameByProject[projectId]?.trim();
    if (!name) {
      return;
    }
    const page = createPageDocument(name);
    this.storage.addPage(projectId, page);
    this.pageNameByProject[projectId] = '';
    this.refresh();
  }

  openBuilder(projectId: string, pageId: string): void {
    this.router.navigate(['/builder', projectId, pageId]);
  }

  duplicatePage(projectId: string, pageId: string): void {
    this.storage.duplicatePage(projectId, pageId);
    this.refresh();
  }

  deletePage(projectId: string, pageId: string): void {
    if (!confirm('Delete this page?')) {
      return;
    }
    this.storage.deletePage(projectId, pageId);
    this.refresh();
  }
}
