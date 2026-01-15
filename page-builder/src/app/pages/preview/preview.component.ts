import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { PageDocument } from '../../models/page-schema';
import { buildHoverStyles } from '../../utils/page-builder-utils';
import { NodeRendererComponent } from '../../components/node-renderer/node-renderer.component';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService,
  ) {}

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    const pageId = this.route.snapshot.paramMap.get('pageId');
    if (!projectId || !pageId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    const page = this.storage.getPage(projectId, pageId);
    if (!page) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.page = page;
    this.hoverStyles = buildHoverStyles(page.root);
  }
}
