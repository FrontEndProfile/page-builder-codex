import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PageDocument } from '../../models/page-schema';
import { buildHoverStyles } from '../../utils/page-builder-utils';
import { NodeRendererComponent } from '../../components/node-renderer/node-renderer.component';
import { FirebaseDataService } from '../../services/firebase-data.service';

@Component({
  selector: 'app-preview',
  standalone: true,
  imports: [CommonModule, NodeRendererComponent],
  templateUrl: './preview.component.html',
  styleUrl: './preview.component.scss',
})
export class PreviewComponent implements OnInit {
  page: PageDocument | null = null;
  hoverStyles = '';
  viewMode: 'desktop' | 'tablet' | 'mobile' = 'desktop';
  private projectId: string | null = null;
  private pageId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: FirebaseDataService,
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
    const page = await this.dataService.getPage(projectId, pageId);
    if (!page) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.page = page;
    this.hoverStyles = buildHoverStyles(page.root);
  }

  goBack(): void {
    if (this.projectId && this.pageId) {
      this.router.navigate(['/builder', this.projectId, this.pageId]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
