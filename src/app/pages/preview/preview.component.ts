import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PageDocument } from '../../models/page-schema';
import { buildHoverStyles } from '../../utils/page-builder-utils';
import { NodeRendererComponent } from '../../components/node-renderer/node-renderer.component';
import { PagesService } from '../../services/pages.service';
import { ProjectsService } from '../../services/projects.service';

@Component({
  selector: 'app-preview',
  standalone: true,
  imports: [CommonModule, NodeRendererComponent, RouterLink],
  templateUrl: './preview.component.html',
  styleUrl: './preview.component.scss',
})
export class PreviewComponent implements OnInit {
  page: PageDocument | null = null;
  hoverStyles = '';
  loading = true;
  viewMode: 'desktop' | 'tablet' | 'mobile' = 'desktop';
  private projectId: string | null = null;
  private pageId: string | null = null;
  builderUrl: string[] = ['/dashboard'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pagesService: PagesService,
    private projectsService: ProjectsService,
  ) {}

  async ngOnInit(): Promise<void> {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    const pageId = this.route.snapshot.paramMap.get('pageId');
    if (!projectId || !pageId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.projectId = projectId;
    this.pageId = pageId;
    this.builderUrl = ['/builder', projectId, pageId];
    this.loading = true;
    const cachedPage = this.getCachedPage(projectId, pageId);
    if (cachedPage) {
      this.page = cachedPage;
      this.hoverStyles = buildHoverStyles(cachedPage.root);
    }
    try {
      const page = await this.pagesService.getPage(projectId, pageId);
      if (!page) {
        this.router.navigate(['/dashboard']);
        return;
      }
      this.page = page;
      this.hoverStyles = buildHoverStyles(page.root);
    } finally {
      this.loading = false;
    }
  }

  goBack(): void {
    if (this.projectId && this.pageId) {
      this.router.navigate(['/builder', this.projectId, this.pageId]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  private getCachedPage(projectId: string, pageId: string): PageDocument | null {
    const cached = this.projectsService.getCachedProjects();
    const project = cached?.find((item) => item.id === projectId);
    if (!project) {
      return null;
    }
    return project.pages.find((page) => page.id === pageId) ?? null;
  }

  get hasContent(): boolean {
    return Boolean(this.page?.root?.children?.length);
  }
}
