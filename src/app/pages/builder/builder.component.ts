import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import JSZip from 'jszip';
import { BuilderService } from '../../services/builder.service';
import { StorageService } from '../../services/storage.service';
import { PageDocument, PageNode, NodeType } from '../../models/page-schema';
import {
  buildDefaultStyles,
  buildHoverStyles,
  collectNodes,
  renderNodeHtml,
} from '../../utils/page-builder-utils';
import { NodeRendererComponent } from '../../components/node-renderer/node-renderer.component';
import { PropertiesPanelComponent } from '../../components/properties-panel/properties-panel.component';

interface LibraryItem {
  type: NodeType;
  label: string;
  description: string;
}

@Component({
  selector: 'app-builder',
  standalone: true,
  imports: [CommonModule, NodeRendererComponent, PropertiesPanelComponent],
  templateUrl: './builder.component.html',
  styleUrl: './builder.component.scss',
})
export class BuilderComponent implements OnInit, OnDestroy {
  page: PageDocument | null = null;
  selectedNode: PageNode | null = null;
  showExportModal = false;

  library: LibraryItem[] = [
    { type: 'section', label: 'Section', description: 'Full-width container.' },
    { type: 'container', label: 'Container', description: 'Simple wrapper.' },
    { type: 'heading', label: 'Heading', description: 'Text headline.' },
    { type: 'text', label: 'Text', description: 'Paragraph text.' },
    { type: 'image', label: 'Image', description: 'Responsive image.' },
    { type: 'button', label: 'Button', description: 'Call-to-action button.' },
    { type: 'divider', label: 'Divider', description: 'Horizontal divider.' },
    { type: 'spacer', label: 'Spacer', description: 'Vertical space.' },
    { type: 'list', label: 'List', description: 'Bulleted list.' },
    { type: 'card', label: 'Card', description: 'Image + text + button.' },
    { type: 'columns2', label: 'Columns', description: 'Two-column layout.' },
    { type: 'hero', label: 'Hero preset', description: 'Hero section preset.' },
  ];

  private projectId: string | null = null;
  private pageId: string | null = null;
  private dragState: {
    nodeId: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public builder: BuilderService,
    private storage: StorageService,
  ) {}

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    const pageId = this.route.snapshot.paramMap.get('pageId');
    if (!projectId || !pageId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.projectId = projectId;
    this.pageId = pageId;
    const loaded = this.builder.loadPage(projectId, pageId);
    if (!loaded) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.page = loaded;
    this.builder.page$.subscribe((page) => {
      this.page = page;
      this.syncSelectedNode();
    });
    this.builder.selectedId$.subscribe(() => this.syncSelectedNode());
  }

  ngOnDestroy(): void {
    this.dragState = null;
  }

  selectNode(node: PageNode): void {
    this.builder.selectNode(node.id);
  }

  addNode(type: NodeType): void {
    if (!this.page) {
      return;
    }
    const targetId = this.selectedNode && this.canAcceptChildren(this.selectedNode)
      ? this.selectedNode.id
      : this.page.root.id;
    this.builder.addNode(type, targetId);
  }

  canAcceptChildren(node: PageNode): boolean {
    return ['section', 'container', 'card', 'columns2', 'hero'].includes(node.type);
  }

  save(): void {
    this.builder.save();
  }

  undo(): void {
    this.builder.undo();
  }

  redo(): void {
    this.builder.redo();
  }

  get canUndo(): boolean {
    return this.builder.canUndo();
  }

  get canRedo(): boolean {
    return this.builder.canRedo();
  }

  openPreview(): void {
    if (!this.projectId || !this.pageId) {
      return;
    }
    this.router.navigate(['/preview', this.projectId, this.pageId]);
  }

  exportJson(): void {
    if (!this.page) {
      return;
    }
    const blob = new Blob([JSON.stringify(this.page, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, `${this.page.name}.json`);
  }

  handleImportFile(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target.files?.length) {
      return;
    }
    const file = target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as PageDocument;
        if (!this.validateDocument(parsed)) {
          alert('Invalid JSON schema.');
          return;
        }
        if (this.projectId) {
          if (this.pageId) {
            parsed.id = this.pageId;
          }
          parsed.updatedAt = Date.now();
          this.storage.updatePage(this.projectId, parsed);
          this.builder.loadPage(this.projectId, parsed.id);
          this.router.navigate(['/builder', this.projectId, parsed.id]);
        }
      } catch {
        alert('Unable to parse JSON file.');
      }
    };
    reader.readAsText(file);
    target.value = '';
  }

  async exportStatic(): Promise<void> {
    if (!this.page) {
      return;
    }
    const zip = new JSZip();
    const html = this.renderHtmlExport();
    const css = this.renderCssExport();
    zip.file('index.html', html);
    zip.file('styles.css', css);
    const blob = await zip.generateAsync({ type: 'blob' });
    this.downloadBlob(blob, 'export.zip');
    this.showExportModal = false;
  }

  async exportAngular(): Promise<void> {
    if (!this.page) {
      return;
    }
    const zip = new JSZip();
    zip.file('page.component.html', this.renderAngularHtml());
    zip.file('page.component.scss', this.renderAngularStyles());
    zip.file(
      'page.component.ts',
      `import { Component } from '@angular/core';\n\n@Component({\n  selector: 'app-page',\n  standalone: true,\n  templateUrl: './page.component.html',\n  styleUrl: './page.component.scss',\n})\nexport class PageComponent {}\n`,
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    this.downloadBlob(blob, 'export.zip');
    this.showExportModal = false;
  }

  handleStartDrag(event: { node: PageNode; event: MouseEvent }): void {
    event.event.preventDefault();
    const left = this.parsePx(event.node.styles.default.left);
    const top = this.parsePx(event.node.styles.default.top);
    this.dragState = {
      nodeId: event.node.id,
      mode: 'move',
      startX: event.event.clientX,
      startY: event.event.clientY,
      startLeft: left,
      startTop: top,
      startWidth: this.parsePx(event.node.styles.default.width),
      startHeight: this.parsePx(event.node.styles.default.height),
    };
  }

  handleStartResize(event: { node: PageNode; event: MouseEvent }): void {
    event.event.preventDefault();
    const width = this.parsePx(event.node.styles.default.width || '200px');
    const height = this.parsePx(event.node.styles.default.height || '120px');
    this.dragState = {
      nodeId: event.node.id,
      mode: 'resize',
      startX: event.event.clientX,
      startY: event.event.clientY,
      startLeft: this.parsePx(event.node.styles.default.left),
      startTop: this.parsePx(event.node.styles.default.top),
      startWidth: width,
      startHeight: height,
    };
  }

  @HostListener('window:mousemove', ['$event'])
  handleMouseMove(event: MouseEvent): void {
    if (!this.dragState) {
      return;
    }
    const deltaX = event.clientX - this.dragState.startX;
    const deltaY = event.clientY - this.dragState.startY;
    if (this.dragState.mode === 'move') {
      this.builder.updateNode(this.dragState.nodeId, (node) => {
        node.styles.default.left = `${this.dragState!.startLeft + deltaX}px`;
        node.styles.default.top = `${this.dragState!.startTop + deltaY}px`;
      });
    } else {
      this.builder.updateNode(this.dragState.nodeId, (node) => {
        node.styles.default.width = `${Math.max(40, this.dragState!.startWidth + deltaX)}px`;
        node.styles.default.height = `${Math.max(24, this.dragState!.startHeight + deltaY)}px`;
      });
    }
  }

  @HostListener('window:mouseup')
  handleMouseUp(): void {
    this.dragState = null;
  }

  getHoverStyles(): string {
    return this.page ? buildHoverStyles(this.page.root) : '';
  }

  private renderHtmlExport(): string {
    if (!this.page) {
      return '';
    }
    const body = renderNodeHtml(this.page.root);
    return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${this.page.name}</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n${body}\n</body>\n</html>`;
  }

  private renderCssExport(): string {
    if (!this.page) {
      return '';
    }
    const base = `body { margin: 0; font-family: ${this.page.settings.primaryFont}; color: ${
      this.page.settings.baseTextColor
    }; background: ${this.page.settings.baseBg}; }`;
    const defaults = buildDefaultStyles(this.page.root);
    const hover = buildHoverStyles(this.page.root);
    return [base, defaults, hover].filter(Boolean).join('\n');
  }

  private renderAngularHtml(): string {
    if (!this.page) {
      return '';
    }
    return `<div class="page-root">${renderNodeHtml(this.page.root)}</div>`;
  }

  private renderAngularStyles(): string {
    if (!this.page) {
      return '';
    }
    const base = `:host { display: block; font-family: ${this.page.settings.primaryFont}; color: ${
      this.page.settings.baseTextColor
    }; background: ${this.page.settings.baseBg}; }`;
    const defaults = buildDefaultStyles(this.page.root);
    const hover = buildHoverStyles(this.page.root);
    return [base, defaults, hover].filter(Boolean).join('\n');
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private parsePx(value: string | undefined): number {
    if (!value) {
      return 0;
    }
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private validateDocument(doc: PageDocument): boolean {
    return Boolean(doc?.id && doc?.name && doc?.root && doc?.settings);
  }

  private syncSelectedNode(): void {
    if (!this.page) {
      this.selectedNode = null;
      return;
    }
    const selectedId = this.builder.selectedId;
    if (!selectedId) {
      this.selectedNode = null;
      return;
    }
    this.selectedNode = collectNodes(this.page.root).find((node) => node.id === selectedId) ?? null;
  }
}
