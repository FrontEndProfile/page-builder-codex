import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import JSZip from 'jszip';
import { BuilderService } from '../../services/builder.service';
import { FirebaseDataService } from '../../services/firebase-data.service';
import { FirebaseStorageService } from '../../services/firebase-storage.service';
import { ToastService } from '../../services/toast.service';
import { PageDocument, PageNode, NodeType } from '../../models/page-schema';
import {
  buildDefaultStyles,
  buildHoverStyles,
  collectNodes,
  renderNodeHtml,
  createPageDocument,
  createNode,
} from '../../utils/page-builder-utils';
import { NodeRendererComponent } from '../../components/node-renderer/node-renderer.component';
import { PropertiesPanelComponent } from '../../components/properties-panel/properties-panel.component';

interface LibraryItem {
  type: NodeType;
  label: string;
  description: string;
}

interface LayoutPreset {
  id: string;
  label: string;
  category: string;
  thumbnail: string;
  build: () => PageNode;
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
  sidebarMode: 'add' | 'pages' | 'navigator' | null = 'navigator';
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

  layoutGroups: { title: string; items: LayoutPreset[] }[] = [
    {
      title: 'Navigation',
      items: [
        {
          id: 'nav-center',
          label: 'Navbar Logo Center',
          category: 'Navigation',
          thumbnail: 'assets/layouts/navbar-center.svg',
          build: () => this.buildNavbarCenter(),
        },
        {
          id: 'nav-left',
          label: 'Navbar Logo Left',
          category: 'Navigation',
          thumbnail: 'assets/layouts/navbar-left.svg',
          build: () => this.buildNavbarLeft(),
        },
        {
          id: 'nav-clean',
          label: 'Navbar No Shadow',
          category: 'Navigation',
          thumbnail: 'assets/layouts/navbar-shadowless.svg',
          build: () => this.buildNavbarNoShadow(),
        },
      ],
    },
    {
      title: 'Hero',
      items: [
        {
          id: 'hero-center',
          label: 'Hero Heading Center',
          category: 'Hero',
          thumbnail: 'assets/layouts/hero-center.svg',
          build: () => this.buildHeroCenter(),
        },
        {
          id: 'hero-right',
          label: 'Hero Heading Right',
          category: 'Hero',
          thumbnail: 'assets/layouts/hero-right.svg',
          build: () => this.buildHeroRight(),
        },
      ],
    },
    {
      title: 'Footer',
      items: [
        {
          id: 'footer-subscribe',
          label: 'Footer Subscribe',
          category: 'Footer',
          thumbnail: 'assets/layouts/footer-subscribe.svg',
          build: () => this.buildFooterSubscribe(),
        },
        {
          id: 'footer-links',
          label: 'Footer Menu + Social',
          category: 'Footer',
          thumbnail: 'assets/layouts/footer-links.svg',
          build: () => this.buildFooterLinks(),
        },
      ],
    },
    {
      title: 'Sections',
      items: [
        {
          id: 'features',
          label: 'Feature Grid',
          category: 'Sections',
          thumbnail: 'assets/layouts/feature-grid.svg',
          build: () => this.buildFeatureGrid(),
        },
        {
          id: 'cta',
          label: 'CTA Banner',
          category: 'Sections',
          thumbnail: 'assets/layouts/cta-banner.svg',
          build: () => this.buildCtaBanner(),
        },
        {
          id: 'testimonials',
          label: 'Testimonials',
          category: 'Sections',
          thumbnail: 'assets/layouts/testimonials.svg',
          build: () => this.buildTestimonials(),
        },
        {
          id: 'pricing',
          label: 'Pricing',
          category: 'Sections',
          thumbnail: 'assets/layouts/pricing.svg',
          build: () => this.buildPricing(),
        },
      ],
    },
  ];

  projectPages: PageDocument[] = [];
  newPageName = '';
  newPageError = '';
  showUnsavedModal = false;
  pendingPageId: string | null = null;
  isLoading = false;
  loadingMessage = 'Loading...';
  showPageSettings = false;
  showDeletePageModal = false;
  ogImages: string[] = [];
  ogLoading = false;

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
    private storageService: FirebaseStorageService,
    private toast: ToastService,
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
    debugger
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

  addLayout(preset: LayoutPreset): void {
    if (!this.page) {
      return;
    }
    const targetId = this.selectedNode && this.canAcceptChildren(this.selectedNode)
      ? this.selectedNode.id
      : this.page.root.id;
    const layoutNode = preset.build();
    this.builder.updateNode(targetId, (node) => {
      node.children = node.children ?? [];
      node.children.push(layoutNode);
    });
  }

  canAcceptChildren(node: PageNode): boolean {
    return ['header', 'footer', 'section', 'container', 'card', 'columns2', 'hero'].includes(node.type);
  }

  private buildNavbarCenter(): PageNode {
    const header = this.createHeader('Navbar Center', {
      padding: '16px 24px',
      backgroundColor: '#0f172a',
      color: '#ffffff',
    });
    const nav = this.createContainer('Nav Row', {
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: '16px',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0',
    });
    const left = this.createContainer('Left Links', {
      display: 'flex',
      gap: '16px',
      alignItems: 'center',
      padding: '0',
    }, [
      this.createText('Home'),
      this.createText('Services'),
      this.createText('Contact'),
    ]);
    const logo = this.createHeading('Brand', 'h4', { margin: '0', fontSize: '18px' });
    const right = this.createContainer('Right CTA', {
      display: 'flex',
      justifyContent: 'flex-end',
      padding: '0',
    }, [this.createButton('Get Started')]);
    nav.children = [left, logo, right];
    header.children = [nav];
    return header;
  }

  private buildNavbarLeft(): PageNode {
    const header = this.createHeader('Navbar Left', {
      padding: '16px 24px',
      backgroundColor: '#0f172a',
      color: '#ffffff',
    });
    const nav = this.createContainer('Nav Row', {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0',
    });
    const logo = this.createHeading('Brand', 'h4', { margin: '0', fontSize: '18px' });
    const links = this.createContainer('Links', {
      display: 'flex',
      gap: '16px',
      alignItems: 'center',
      padding: '0',
    }, [
      this.createText('Home'),
      this.createText('Features'),
      this.createText('Pricing'),
    ]);
    nav.children = [logo, links, this.createButton('Contact')];
    header.children = [nav];
    return header;
  }

  private buildNavbarNoShadow(): PageNode {
    const header = this.createHeader('Navbar Clean', {
      padding: '16px 24px',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      borderBottom: '1px solid #e2e8f0',
    });
    const nav = this.createContainer('Nav Row', {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0',
    });
    const logo = this.createHeading('Brand', 'h4', { margin: '0', fontSize: '18px' });
    const links = this.createContainer('Links', {
      display: 'flex',
      gap: '16px',
      alignItems: 'center',
      padding: '0',
    }, [
      this.createText('Home', { color: '#0f172a' }),
      this.createText('Docs', { color: '#0f172a' }),
      this.createText('Contact', { color: '#0f172a' }),
    ]);
    nav.children = [logo, links, this.createButton('Sign Up', { backgroundColor: '#111827' })];
    header.children = [nav];
    return header;
  }

  private buildHeroCenter(): PageNode {
    const section = this.createSection('Hero Center', {
      padding: '96px 24px',
      backgroundColor: '#0f172a',
      color: '#ffffff',
    });
    const container = this.createContainer('Hero Content', {
      maxWidth: '720px',
      margin: '0 auto',
      textAlign: 'center',
      display: 'grid',
      gap: '16px',
      padding: '0',
    }, [
      this.createHeading('Build faster with Page Builder', 'h1', { margin: '0' }),
      this.createText('Create beautiful layouts with reusable blocks and export clean code.', {
        margin: '0',
        color: '#cbd5f5',
      }),
      this.createButton('Get started', { alignSelf: 'center' }),
    ]);
    section.children = [container];
    return section;
  }

  private buildHeroRight(): PageNode {
    const section = this.createSection('Hero Right', {
      padding: '96px 24px',
      backgroundColor: '#0f172a',
      color: '#ffffff',
    });
    const container = this.createContainer('Hero Grid', {
      display: 'grid',
      gridTemplateColumns: '1.1fr 0.9fr',
      gap: '32px',
      alignItems: 'center',
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '0',
    });
    const left = this.createContainer('Hero Text', {
      display: 'grid',
      gap: '16px',
      padding: '0',
    }, [
      this.createHeading('Launch your next idea', 'h1', { margin: '0' }),
      this.createText('Design, edit, and publish with a modern drag-and-drop workflow.', {
        margin: '0',
        color: '#cbd5f5',
      }),
      this.createButton('Start free', { alignSelf: 'start' }),
    ]);
    const image = createNode('image');
    image.styles.default = {
      ...image.styles.default,
      borderRadius: '20px',
      height: '320px',
      objectFit: 'cover',
    };
    container.children = [left, image];
    section.children = [container];
    return section;
  }

  private buildFooterSubscribe(): PageNode {
    const footer = this.createFooter('Footer Subscribe', {
      padding: '48px 24px',
      backgroundColor: '#0f172a',
      color: '#cbd5f5',
    });
    const container = this.createContainer('Footer Row', {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '24px',
      alignItems: 'center',
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '0',
    });
    const left = this.createContainer('Footer Copy', {
      display: 'grid',
      gap: '8px',
      padding: '0',
    }, [
      this.createHeading('Stay in the loop', 'h3', { margin: '0', color: '#ffffff', fontSize: '22px' }),
      this.createText('Join our newsletter for product updates and tips.', { margin: '0' }),
    ]);
    const input = this.createContainer('Email Field', {
      padding: '10px 18px',
      borderRadius: '999px',
      backgroundColor: '#111827',
      color: '#94a3b8',
    }, [this.createText('Enter your email', { margin: '0' })]);
    const right = this.createContainer('Subscribe', {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      padding: '0',
    }, [input, this.createButton('Subscribe')]);
    container.children = [left, right];
    footer.children = [container];
    return footer;
  }

  private buildFooterLinks(): PageNode {
    const footer = this.createFooter('Footer Links', {
      padding: '56px 24px',
      backgroundColor: '#0f172a',
      color: '#cbd5f5',
    });
    const container = this.createContainer('Footer Columns', {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr 1fr',
      gap: '24px',
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '0',
    });
    const col1 = this.createContainer('Brand', { display: 'grid', gap: '8px', padding: '0' }, [
      this.createHeading('Brand', 'h4', { margin: '0', color: '#ffffff', fontSize: '18px' }),
      this.createText('A flexible page builder for modern teams.', { margin: '0' }),
    ]);
    const menu = createNode('list');
    menu.content = { text: 'Home\nFeatures\nPricing\nContact' };
    menu.styles.default = { paddingLeft: '18px', margin: '0', color: '#cbd5f5' };
    menu.meta = { name: 'Menu Links' };
    const social = this.createContainer('Social', { display: 'grid', gap: '8px', padding: '0' }, [
      this.createText('Follow us', { margin: '0' }),
      this.createButton('Twitter', { padding: '8px 14px', borderRadius: '999px' }),
      this.createButton('LinkedIn', { padding: '8px 14px', borderRadius: '999px' }),
    ]);
    container.children = [col1, menu, social];
    footer.children = [container];
    return footer;
  }

  private buildFeatureGrid(): PageNode {
    const section = this.createSection('Feature Grid', {
      padding: '80px 24px',
      backgroundColor: '#f8fafc',
    });
    const container = this.createContainer('Feature Wrap', {
      maxWidth: '1100px',
      margin: '0 auto',
      display: 'grid',
      gap: '24px',
      padding: '0',
    }, [
      this.createHeading('Everything you need', 'h2', { margin: '0' }),
      this.createText('Launch pages quickly with reusable blocks and styles.', { margin: '0' }),
    ]);
    const grid = this.createContainer('Feature Cards', {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '16px',
      padding: '0',
    }, [createNode('card'), createNode('card'), createNode('card')]);
    container.children = [...(container.children ?? []), grid];
    section.children = [container];
    return section;
  }

  private buildCtaBanner(): PageNode {
    const section = this.createSection('CTA Banner', {
      padding: '60px 24px',
      backgroundColor: '#f8fafc',
    });
    const banner = this.createContainer('CTA', {
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '32px',
      borderRadius: '20px',
      backgroundColor: '#111827',
      color: '#ffffff',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
    }, [
      this.createHeading('Ready to publish?', 'h3', { margin: '0', fontSize: '24px' }),
      this.createButton('Talk to sales'),
    ]);
    section.children = [banner];
    return section;
  }

  private buildTestimonials(): PageNode {
    const section = this.createSection('Testimonials', {
      padding: '80px 24px',
      backgroundColor: '#f8fafc',
    });
    const container = this.createContainer('Testimonials Wrap', {
      maxWidth: '1100px',
      margin: '0 auto',
      display: 'grid',
      gap: '20px',
      padding: '0',
    }, [
      this.createHeading('Teams love it', 'h2', { margin: '0' }),
      this.createText('Trusted by designers and product teams worldwide.', { margin: '0' }),
    ]);
    const grid = this.createContainer('Testimonials Grid', {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '16px',
      padding: '0',
    }, [
      this.createContainer('Quote 1', {
        padding: '20px',
        borderRadius: '16px',
        backgroundColor: '#ffffff',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
      }, [this.createText('“The builder saved us weeks of work.”', { margin: '0' })]),
      this.createContainer('Quote 2', {
        padding: '20px',
        borderRadius: '16px',
        backgroundColor: '#ffffff',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
      }, [this.createText('“Clean export and beautiful layouts.”', { margin: '0' })]),
    ]);
    container.children = [...(container.children ?? []), grid];
    section.children = [container];
    return section;
  }

  private buildPricing(): PageNode {
    const section = this.createSection('Pricing', {
      padding: '80px 24px',
      backgroundColor: '#ffffff',
    });
    const container = this.createContainer('Pricing Wrap', {
      maxWidth: '1100px',
      margin: '0 auto',
      display: 'grid',
      gap: '24px',
      padding: '0',
    }, [
      this.createHeading('Simple pricing', 'h2', { margin: '0' }),
      this.createText('Choose a plan that fits your team.', { margin: '0' }),
    ]);
    const cards = this.createContainer('Pricing Cards', {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '16px',
      padding: '0',
    }, [
      this.createContainer('Starter', {
        padding: '20px',
        borderRadius: '16px',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
      }, [this.createHeading('Starter', 'h4', { margin: '0', fontSize: '18px' }), this.createText('$9 / month', { margin: '0' })]),
      this.createContainer('Pro', {
        padding: '20px',
        borderRadius: '16px',
        backgroundColor: '#eef2ff',
        border: '1px solid #c7d2fe',
      }, [this.createHeading('Pro', 'h4', { margin: '0', fontSize: '18px' }), this.createText('$29 / month', { margin: '0' })]),
      this.createContainer('Team', {
        padding: '20px',
        borderRadius: '16px',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
      }, [this.createHeading('Team', 'h4', { margin: '0', fontSize: '18px' }), this.createText('$59 / month', { margin: '0' })]),
    ]);
    container.children = [...(container.children ?? []), cards];
    section.children = [container];
    return section;
  }

  private createSection(name: string, styles: Record<string, string>): PageNode {
    const node = createNode('section');
    node.meta = { name };
    node.styles.default = { ...node.styles.default, ...styles };
    node.children = [];
    return node;
  }

  private createHeader(name: string, styles: Record<string, string>): PageNode {
    const node = createNode('header');
    node.meta = { name };
    node.styles.default = { ...node.styles.default, ...styles };
    node.children = [];
    return node;
  }

  private createFooter(name: string, styles: Record<string, string>): PageNode {
    const node = createNode('footer');
    node.meta = { name };
    node.styles.default = { ...node.styles.default, ...styles };
    node.children = [];
    return node;
  }

  private createContainer(
    name: string,
    styles: Record<string, string>,
    children?: PageNode[],
  ): PageNode {
    const node = createNode('container');
    node.meta = { name };
    node.styles.default = { ...node.styles.default, ...styles };
    node.children = children ?? [];
    return node;
  }

  private createHeading(
    text: string,
    tag: NonNullable<PageNode['content']>['tag'],
    styles?: Record<string, string>,
  ): PageNode {
    const node = createNode('heading');
    node.content = { text, tag };
    node.meta = { name: text };
    node.styles.default = { ...node.styles.default, ...(styles ?? {}) };
    return node;
  }

  private createText(text: string, styles?: Record<string, string>): PageNode {
    const node = createNode('text');
    node.content = { text, tag: 'p' };
    node.meta = { name: 'Text' };
    node.styles.default = { ...node.styles.default, ...(styles ?? {}) };
    return node;
  }

  private createButton(text: string, styles?: Record<string, string>): PageNode {
    const node = createNode('button');
    node.content = { text, href: '#', target: '_self' };
    node.meta = { name: text };
    node.styles.default = { ...node.styles.default, ...(styles ?? {}) };
    return node;
  }

  save(): void {
    this.builder.save();
    this.toast.show('Page saved.', 'success');
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
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/preview', this.projectId, this.pageId]),
    );
    window.open(url, '_blank', 'noopener');
  }

  async goDashboard(): Promise<void> {
    await this.router.navigate(['/dashboard']);
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
    if (this.isLoading) {
      return;
    }
    if (!this.projectId) {
      return;
    }
    if (!this.newPageName.trim()) {
      this.newPageError = 'Page name is required.';
      this.toast.show('Page name is required.', 'error');
      return;
    }
    if (
      this.projectPages.some(
        (page) => page.name.trim().toLowerCase() === this.newPageName.trim().toLowerCase(),
      )
    ) {
      this.newPageError = 'Page name already exists.';
      this.toast.show('Page name already exists.', 'error');
      return;
    }
    this.newPageError = '';
    this.setLoading(true, 'Creating page...');
    const page = createPageDocument(this.newPageName.trim());
    try {
      await this.dataService.addPage(this.projectId, page);
      this.newPageName = '';
      if (!this.projectPages.find((item) => item.id === page.id)) {
        this.projectPages = [...this.projectPages, page];
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create page.';
      this.toast.show(message, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  onNewPageNameChange(value: string): void {
    if (value.trim()) {
      this.newPageError = '';
    }
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

  togglePageSettings(): void {
    this.showPageSettings = !this.showPageSettings;
    if (this.showPageSettings) {
      void this.loadOgImages();
    }
  }

  toggleSidebar(mode: 'add' | 'pages' | 'navigator'): void {
    this.sidebarMode = this.sidebarMode === mode ? null : mode;
  }

  updatePageName(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    this.builder.updatePageInfo((page) => {
      page.name = trimmed;
      if (page.seo) {
        if (!page.seo.titleTag) {
          page.seo.titleTag = trimmed;
        }
        if (!page.seo.ogTitle) {
          page.seo.ogTitle = trimmed;
        }
      }
    });
  }

  getSeoValue(key: Exclude<keyof NonNullable<PageDocument['seo']>, 'sitemapIndex'>): string {
    return this.page?.seo?.[key] ?? '';
  }

  getSitemapIndex(): boolean {
    return this.page?.seo?.sitemapIndex ?? true;
  }

  updateSeoValue(key: keyof NonNullable<PageDocument['seo']>, value: string | boolean): void {
    this.builder.updatePageInfo((page) => {
      page.seo = page.seo ?? {
        titleTag: page.name,
        metaDescription: '',
        sitemapIndex: true,
        ogTitle: page.name,
        ogDescription: '',
        ogImage: '',
      };
      (page.seo as Record<string, string | boolean>)[key] = value;
    });
  }

  async handleOgImageUpload(event: Event): Promise<void> {
    if (!this.projectId) {
      return;
    }
    const target = event.target as HTMLInputElement;
    if (!target.files?.length) {
      return;
    }
    this.ogLoading = true;
    try {
      const url = await this.storageService.uploadImage(this.projectId, target.files[0]);
      this.updateSeoValue('ogImage', url);
      await this.loadOgImages();
    } finally {
      this.ogLoading = false;
      target.value = '';
    }
  }

  selectOgImage(url: string): void {
    this.updateSeoValue('ogImage', url);
  }

  requestDeletePage(): void {
    this.showDeletePageModal = true;
  }

  async confirmDeletePage(): Promise<void> {
    if (!this.projectId || !this.pageId) {
      this.showDeletePageModal = false;
      return;
    }
    this.setLoading(true, 'Deleting page...');
    await this.dataService.deletePage(this.projectId, this.pageId);
    await this.loadProjectPages();
    const next = this.projectPages.find((page) => page.id !== this.pageId);
    this.showDeletePageModal = false;
    if (next) {
      await this.router.navigate(['/builder', this.projectId, next.id]);
    } else {
      await this.router.navigate(['/dashboard']);
    }
    this.setLoading(false);
  }

  private async loadOgImages(): Promise<void> {
    if (!this.projectId) {
      return;
    }
    this.ogLoading = true;
    try {
      this.ogImages = await this.storageService.listProjectImages(this.projectId);
    } catch {
      this.ogImages = [];
    } finally {
      this.ogLoading = false;
    }
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

  trackByPageId(_: number, page: { id: string }): string {
    return page.id;
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
