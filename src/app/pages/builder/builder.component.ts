import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import JSZip from 'jszip';
import { BuilderService } from '../../services/builder.service';
import { FirebaseDataService } from '../../services/firebase-data.service';
import { PageDocument, PageNode, NodeType } from '../../models/page-schema';
import {
  buildDefaultStyles,
  buildHoverStyles,
  collectNodes,
  renderNodeHtml,
  createPageDocument,
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
  imports: [CommonModule, FormsModule, NodeRendererComponent, PropertiesPanelComponent],
  templateUrl: './builder.component.html',
  styleUrl: './builder.component.scss',
})
export class BuilderComponent implements OnInit, OnDestroy {
  page: PageDocument | null = null;
  selectedNode: PageNode | null = null;
  showExportModal = false;
  showVersionsModal = false;
  versions: { id: string; createdAt: number; note: string }[] = [];
  versionsLoading = false;
  sidebarTab: 'library' | 'layers' = 'library';
  sidebarMode: 'add' | 'pages' | 'navigator' = 'add';
  addTab: 'elements' | 'layouts' = 'elements';
  viewMode: 'desktop' | 'tablet' | 'mobile' = 'desktop';
  frameWidth = {
    tablet: 900,
    mobile: 420,
  };
  private frameResizeStart: { mode: 'tablet' | 'mobile'; startX: number; startWidth: number } | null =
    null;

  library: LibraryItem[] = [
    { type: 'header', label: 'Header', description: 'Header section.' },
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
    { type: 'footer', label: 'Footer', description: 'Footer section.' },
  ];

  libraryGroups: { title: string; items: LibraryItem[] }[] = [
    {
      title: 'Structure',
      items: [
        { type: 'section', label: 'Section', description: 'Full-width container.' },
        { type: 'container', label: 'Container', description: 'Simple wrapper.' },
        { type: 'columns2', label: 'Columns', description: 'Two-column layout.' },
      ],
    },
    {
      title: 'Typography',
      items: [
        { type: 'heading', label: 'Heading', description: 'Text headline.' },
        { type: 'text', label: 'Text', description: 'Paragraph text.' },
      ],
    },
    {
      title: 'Media',
      items: [{ type: 'image', label: 'Image', description: 'Responsive image.' }],
    },
    {
      title: 'Basic',
      items: [
        { type: 'button', label: 'Button', description: 'Call-to-action button.' },
        { type: 'divider', label: 'Divider', description: 'Horizontal divider.' },
        { type: 'spacer', label: 'Spacer', description: 'Vertical space.' },
        { type: 'list', label: 'List', description: 'Bulleted list.' },
        { type: 'card', label: 'Card', description: 'Image + text + button.' },
        { type: 'hero', label: 'Hero preset', description: 'Hero section preset.' },
        { type: 'header', label: 'Header', description: 'Header section.' },
        { type: 'footer', label: 'Footer', description: 'Footer section.' },
      ],
    },
  ];

  projectPages: PageDocument[] = [];
  newPageName = '';
  showUnsavedModal = false;
  pendingPageId: string | null = null;
  isLoading = false;
  loadingMessage = 'Loading...';

  projectId: string | null = null;
  pageId: string | null = null;
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
  private collapsedNodes = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public builder: BuilderService,
    private dataService: FirebaseDataService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const projectId = params.get('projectId');
      const pageId = params.get('pageId');
      if (!projectId || !pageId) {
        this.router.navigate(['/dashboard']);
        return;
      }
      void this.loadPageForRoute(projectId, pageId);
    });
  }

  private async loadPageForRoute(projectId: string, pageId: string): Promise<void> {
    this.setLoading(true, 'Loading page...');
    this.projectId = projectId;
    this.pageId = pageId;
    const loaded = await this.builder.loadPage(projectId, pageId);
    if (!loaded) {
      this.setLoading(false);
      this.router.navigate(['/dashboard']);
      return;
    }
    this.page = loaded;
    if (!this.pageSubscriptionsInitialized) {
      this.builder.page$.subscribe((page) => {
        this.page = page;
        this.syncSelectedNode();
      });
      this.builder.selectedId$.subscribe(() => this.syncSelectedNode());
      this.pageSubscriptionsInitialized = true;
    }
    await this.loadProjectPages();
    this.setLoading(false);
  }

  private pageSubscriptionsInitialized = false;

  ngOnDestroy(): void {
    this.dragState = null;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      return;
    }
    const isDelete = event.key === 'Delete' || event.key === 'Backspace';
    const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
    const isRedo =
      (event.metaKey || event.ctrlKey) &&
      (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
    const isMetaDelete = event.metaKey && event.key === 'Backspace';
    if (isUndo) {
      event.preventDefault();
      this.undo();
      return;
    }
    if (isRedo) {
      event.preventDefault();
      this.redo();
      return;
    }
    if (isDelete || isMetaDelete) {
      event.preventDefault();
      this.deleteSelected();
    }
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
    return ['header', 'footer', 'section', 'container', 'card', 'columns2', 'hero'].includes(node.type);
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

  deleteSelected(): void {
    if (!this.selectedNode || !this.page) {
      return;
    }
    if (this.selectedNode.id === this.page.root.id) {
      return;
    }
    this.builder.deleteNode(this.selectedNode.id);
  }

  handleReorder(event: {
    nodeId: string;
    fromParentId: string;
    fromIndex: number;
    toParentId: string;
    toIndex: number;
  }): void {
    if (!this.page) {
      return;
    }
    if (event.fromParentId === event.toParentId && event.fromIndex === event.toIndex) {
      return;
    }
    this.builder.moveNode(event.nodeId, event.toParentId, event.toIndex);
  }

  startFrameResize(event: MouseEvent, mode: 'tablet' | 'mobile'): void {
    event.preventDefault();
    this.frameResizeStart = {
      mode,
      startX: event.clientX,
      startWidth: this.frameWidth[mode],
    };
  }


  getLayerLabel(node: PageNode): string {
    return node.meta?.name ?? node.type;
  }

  isExpanded(node: PageNode): boolean {
    if (!node.children?.length) {
      return true;
    }
    return !this.collapsedNodes.has(node.id);
  }

  toggleExpanded(node: PageNode): void {
    if (!node.children?.length) {
      return;
    }
    if (this.collapsedNodes.has(node.id)) {
      this.collapsedNodes.delete(node.id);
    } else {
      this.collapsedNodes.add(node.id);
    }
  }

  moveLayer(node: PageNode, direction: -1 | 1): void {
    if (!this.page) {
      return;
    }
    const info = this.findParent(this.page.root, node.id);
    if (!info) {
      return;
    }
    const newIndex = info.index + direction;
    if (newIndex < 0 || newIndex >= info.parent.children!.length) {
      return;
    }
    const targetIndex = direction === 1 ? info.index + 2 : info.index - 1;
    this.builder.moveNode(node.id, info.parent.id, targetIndex);
  }

  canMoveLayer(node: PageNode, direction: -1 | 1): boolean {
    if (!this.page || node.id === this.page.root.id) {
      return false;
    }
    const info = this.findParent(this.page.root, node.id);
    if (!info || !info.parent.children) {
      return false;
    }
    const newIndex = info.index + direction;
    return newIndex >= 0 && newIndex < info.parent.children.length;
  }

  trackById(_: number, node: PageNode): string {
    return node.id;
  }

  private findParent(
    root: PageNode,
    childId: string,
  ): { parent: PageNode; index: number } | null {
    const children = root.children ?? [];
    const index = children.findIndex((child) => child.id === childId);
    if (index !== -1) {
      return { parent: root, index };
    }
    for (const child of children) {
      const found = this.findParent(child, childId);
      if (found) {
        return found;
      }
    }
    return null;
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
          void this.dataService.updatePage(this.projectId, parsed).then(() => {
            void this.builder.loadPage(this.projectId!, parsed.id);
            this.router.navigate(['/builder', this.projectId, parsed.id]);
          });
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
    if (this.projectId && this.pageId) {
      const next = await this.dataService.getNextVersionNumber(this.projectId, this.pageId);
      await this.dataService.addVersion(
        this.projectId,
        this.pageId,
        this.page,
        `export snapshot ${next}`,
      );
    }
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
    if (this.projectId && this.pageId) {
      const next = await this.dataService.getNextVersionNumber(this.projectId, this.pageId);
      await this.dataService.addVersion(
        this.projectId,
        this.pageId,
        this.page,
        `export snapshot ${next}`,
      );
    }
    this.showExportModal = false;
  }

  async openVersions(): Promise<void> {
    if (!this.projectId || !this.pageId) {
      return;
    }
    this.versionsLoading = true;
    this.showVersionsModal = true;
    try {
      this.versions = await this.dataService.listVersions(this.projectId, this.pageId);
    } finally {
      this.versionsLoading = false;
    }
  }

  async restoreVersion(versionId: string): Promise<void> {
    if (!this.projectId || !this.pageId) {
      return;
    }
    const snapshot = await this.dataService.getVersionSnapshot(this.projectId, this.pageId, versionId);
    if (!snapshot) {
      return;
    }
    snapshot.updatedAt = Date.now();
    await this.dataService.updatePage(this.projectId, snapshot);
    await this.builder.loadPage(this.projectId, snapshot.id);
    this.showVersionsModal = false;
  }

  handleStartDrag(event: { node: PageNode; event: MouseEvent }): void {
    event.event.preventDefault();
    const left = this.parsePx(this.getStyleForViewport(event.node, 'left'));
    const top = this.parsePx(this.getStyleForViewport(event.node, 'top'));
    this.dragState = {
      nodeId: event.node.id,
      mode: 'move',
      startX: event.event.clientX,
      startY: event.event.clientY,
      startLeft: left,
      startTop: top,
      startWidth: this.parsePx(this.getStyleForViewport(event.node, 'width')),
      startHeight: this.parsePx(this.getStyleForViewport(event.node, 'height')),
    };
  }

  handleStartResize(event: { node: PageNode; event: MouseEvent }): void {
    event.event.preventDefault();
    const width = this.parsePx(this.getStyleForViewport(event.node, 'width') || '200px');
    const height = this.parsePx(this.getStyleForViewport(event.node, 'height') || '120px');
    this.dragState = {
      nodeId: event.node.id,
      mode: 'resize',
      startX: event.event.clientX,
      startY: event.event.clientY,
      startLeft: this.parsePx(this.getStyleForViewport(event.node, 'left')),
      startTop: this.parsePx(this.getStyleForViewport(event.node, 'top')),
      startWidth: width,
      startHeight: height,
    };
  }

  @HostListener('window:mousemove', ['$event'])
  handleMouseMove(event: MouseEvent): void {
    if (this.frameResizeStart) {
      const delta = event.clientX - this.frameResizeStart.startX;
      const minWidth = this.frameResizeStart.mode === 'mobile' ? 320 : 600;
      const maxWidth = this.frameResizeStart.mode === 'mobile' ? 520 : 1100;
      const next = Math.min(maxWidth, Math.max(minWidth, this.frameResizeStart.startWidth + delta));
      this.frameWidth[this.frameResizeStart.mode] = Math.round(next);
    }
    if (!this.dragState) {
      return;
    }
    const deltaX = event.clientX - this.dragState.startX;
    const deltaY = event.clientY - this.dragState.startY;
    if (this.dragState.mode === 'move') {
      this.builder.updateNode(this.dragState.nodeId, (node) => {
        node.styles.default[this.resolveStyleKey('left')] = `${this.dragState!.startLeft + deltaX}px`;
        node.styles.default[this.resolveStyleKey('top')] = `${this.dragState!.startTop + deltaY}px`;
      });
    } else {
      this.builder.updateNode(this.dragState.nodeId, (node) => {
        node.styles.default[this.resolveStyleKey('width')] = `${Math.max(
          40,
          this.dragState!.startWidth + deltaX,
        )}px`;
        node.styles.default[this.resolveStyleKey('height')] = `${Math.max(
          24,
          this.dragState!.startHeight + deltaY,
        )}px`;
      });
    }
  }

  @HostListener('window:mouseup')
  handleMouseUp(): void {
    this.dragState = null;
    this.frameResizeStart = null;
  }

  handleQuickUpdate(event: { nodeId: string; field: string; value: string }): void {
    this.builder.updateNode(event.nodeId, (node) => {
      if (event.field.startsWith('style:')) {
        const key = event.field.replace('style:', '');
        node.styles.default = { ...node.styles.default, [this.resolveStyleKey(key)]: event.value };
        return;
      }
      if (!node.content) {
        node.content = {};
      }
      if (event.field === 'text') {
        node.content.text = event.value;
      } else if (event.field === 'src') {
        node.content.src = event.value;
      } else if (event.field === 'alt') {
        node.content.alt = event.value;
      } else if (event.field === 'href') {
        node.content.href = event.value;
      } else if (event.field === 'target') {
        node.content.target = event.value as '_self' | '_blank';
      } else if (event.field === 'tag') {
        node.content.tag = event.value as NonNullable<PageNode['content']>['tag'];
      }
    });
  }

  async loadProjectPages(): Promise<void> {
    if (!this.projectId) {
      return;
    }
    this.setLoading(true, 'Loading pages...');
    const project = await this.dataService.getProject(this.projectId);
    this.projectPages = project?.pages ?? [];
    this.setLoading(false);
  }

  async createPageInline(): Promise<void> {
    if (!this.projectId || !this.newPageName.trim()) {
      return;
    }
    this.setLoading(true, 'Creating page...');
    const page = createPageDocument(this.newPageName.trim());
    await this.dataService.addPage(this.projectId, page);
    this.newPageName = '';
    await this.loadProjectPages();
    this.setLoading(false);
  }

  async openPage(pageId: string): Promise<void> {
    if (!this.projectId) {
      return;
    }
    if (pageId === this.pageId) {
      return;
    }
    if (this.builder.isDirty()) {
      this.pendingPageId = pageId;
      this.showUnsavedModal = true;
      return;
    }
    await this.router.navigate(['/builder', this.projectId, pageId]);
  }

  async confirmNavigate(save: boolean): Promise<void> {
    if (!this.projectId || !this.pendingPageId) {
      this.showUnsavedModal = false;
      return;
    }
    if (save) {
      this.setLoading(true, 'Saving changes...');
      this.builder.save();
    }
    const target = this.pendingPageId;
    this.pendingPageId = null;
    this.showUnsavedModal = false;
    await this.router.navigate(['/builder', this.projectId, target]);
    this.setLoading(false);
  }

  private setLoading(isLoading: boolean, message?: string): void {
    this.isLoading = isLoading;
    if (message) {
      this.loadingMessage = message;
    }
  }

  getHoverStyles(): string {
    return this.page ? buildHoverStyles(this.page.root) : '';
  }

  private renderHtmlExport(): string {
    if (!this.page) {
      return '';
    }
    const body = `<div class="page-root">${renderNodeHtml(this.page.root)}</div>`;
    return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${this.page.name}</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n${body}\n</body>\n</html>`;
  }

  private renderCssExport(): string {
    if (!this.page) {
      return '';
    }
    const base = `body { margin: 0; } .page-root { min-height: 100vh; font-family: ${
      this.page.settings.primaryFont
    }; color: ${this.page.settings.baseTextColor}; background: ${this.page.settings.baseBg}; }`;
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
    const base = `:host { display: block; } .page-root { min-height: 100vh; font-family: ${
      this.page.settings.primaryFont
    }; color: ${this.page.settings.baseTextColor}; background: ${this.page.settings.baseBg}; }`;
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

  private getStyleForViewport(node: PageNode, key: string): string | undefined {
    const responsive = node.styles.default[this.resolveStyleKey(key)];
    if (responsive) {
      return responsive;
    }
    return node.styles.default[key];
  }

  private resolveStyleKey(key: string): string {
    if (this.viewMode === 'tablet') {
      return `bp-tablet-${key}`;
    }
    if (this.viewMode === 'mobile') {
      return `bp-mobile-${key}`;
    }
    return key;
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
