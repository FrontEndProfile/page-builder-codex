import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProjectData } from '../../models/page-schema';
import { createPageDocument } from '../../utils/page-builder-utils';
import { FirebaseDataService } from '../../services/firebase-data.service';
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
  pageNameByProject: Record<string, string> = {};
  loading = true;
  userEmail = '';
  private unsubscribe?: () => void;
  private authSub?: Subscription;

  constructor(
    private dataService: FirebaseDataService,
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
        void this.dataService
          .listProjects()
          .then((projects) => {
            this.projects = projects;
          })
          .finally(() => {
            this.loading = false;
          });
        this.unsubscribe = this.dataService.subscribeProjects(
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
    if (!this.projectName.trim()) {
      return;
    }
    await this.dataService.createProject(this.projectName.trim());
    this.projectName = '';
  }

  async createPage(projectId: string): Promise<void> {
    const name = this.pageNameByProject[projectId]?.trim();
    if (!name) {
      return;
    }
    const page = createPageDocument(name);
    await this.dataService.addPage(projectId, page);
    this.pageNameByProject[projectId] = '';
  }

  openBuilder(projectId: string, pageId: string): void {
    this.router.navigate(['/builder', projectId, pageId]);
  }

  async duplicatePage(projectId: string, pageId: string): Promise<void> {
    await this.dataService.duplicatePage(projectId, pageId);
  }

  async deletePage(projectId: string, pageId: string): Promise<void> {
    if (!confirm('Delete this page?')) {
      return;
    }
    await this.dataService.deletePage(projectId, pageId);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  manageProfile(): void {
    this.toast.show('Profile management is coming soon.', 'info');
  }
}
