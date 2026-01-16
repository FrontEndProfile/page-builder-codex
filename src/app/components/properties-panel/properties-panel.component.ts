import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageNode } from '../../models/page-schema';
import { BuilderService } from '../../services/builder.service';
import { FirebaseStorageService } from '../../services/firebase-storage.service';

interface FontOption {
  label: string;
  stack: string;
  weights: number[];
}

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.scss',
})
export class PropertiesPanelComponent implements OnChanges {
  @Input() node: PageNode | null = null;
  @Input() projectId: string | null = null;
  @Input() pageId: string | null = null;
  @Input() viewMode: 'desktop' | 'tablet' | 'mobile' = 'desktop';

  linkMargin = true;
  linkPadding = true;
  uploadingImage = false;

  constructor(private builder: BuilderService, private storageService: FirebaseStorageService) {}

  fontOptions: FontOption[] = [
    { label: 'Inter', stack: 'Inter, sans-serif', weights: [300, 400, 500, 600, 700] },
    { label: 'Roboto', stack: 'Roboto, sans-serif', weights: [300, 400, 500, 700] },
    { label: 'Lato', stack: 'Lato, sans-serif', weights: [300, 400, 700, 900] },
    { label: 'Open Sans', stack: 'Open Sans, sans-serif', weights: [300, 400, 600, 700] },
    { label: 'Montserrat', stack: 'Montserrat, sans-serif', weights: [300, 400, 500, 600, 700] },
    { label: 'Poppins', stack: 'Poppins, sans-serif', weights: [300, 400, 500, 600, 700] },
    { label: 'Raleway', stack: 'Raleway, sans-serif', weights: [300, 400, 500, 600, 700] },
    { label: 'Nunito', stack: 'Nunito, sans-serif', weights: [300, 400, 600, 700] },
    { label: 'DM Sans', stack: 'DM Sans, sans-serif', weights: [400, 500, 700] },
    { label: 'Work Sans', stack: 'Work Sans, sans-serif', weights: [300, 400, 500, 600, 700] },
    { label: 'Oswald', stack: 'Oswald, sans-serif', weights: [300, 400, 500, 600, 700] },
    { label: 'Merriweather', stack: 'Merriweather, serif', weights: [300, 400, 700, 900] },
    { label: 'Playfair Display', stack: 'Playfair Display, serif', weights: [400, 500, 600, 700, 800, 900] },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['node']) {
      const font = this.getFontFamily();
      if (font) {
        this.ensureFontLoaded(this.getFontLabel(font));
      }
    }
  }

  updateContent(key: keyof NonNullable<PageNode['content']>, value: string): void {
    if (!this.node) {
      return;
    }
    this.builder.updateNode(this.node.id, (node) => {
      node.content = { ...(node.content ?? {}), [key]: value };
    });
  }

  async handleImageUpload(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    if (!target.files?.length || !this.projectId) {
      return;
    }
    const file = target.files[0];
    this.uploadingImage = true;
    try {
      const url = await this.storageService.uploadImage(this.projectId, file);
      this.updateContent('src', url);
    } finally {
      this.uploadingImage = false;
      target.value = '';
    }
  }

  updateStyle(key: string, value: string, state: 'default' | 'hover' = 'default'): void {
    if (!this.node) {
      return;
    }
    this.builder.updateNode(this.node.id, (node) => {
      if (state === 'default') {
        const resolvedKey = this.resolveStyleKey(key);
        node.styles.default = { ...node.styles.default, [resolvedKey]: value };
      } else {
        node.styles.hover = { ...(node.styles.hover ?? {}), [key]: value };
      }
    });
  }

  getFontFamily(): string {
    if (!this.node) {
      return '';
    }
    const nodeFont = this.getStyleValue('fontFamily');
    if (nodeFont) {
      return nodeFont;
    }
    return this.builder.currentPage?.settings.primaryFont ?? '';
  }

  updateFontFamily(value: string): void {
    if (!this.node) {
      return;
    }
    this.ensureFontLoaded(this.getFontLabel(value));
    if (this.builder.currentPage?.root.id === this.node.id) {
      this.builder.updatePageSettings({ primaryFont: value });
    }
    this.updateStyle('fontFamily', value);
  }

  getFontWeights(): number[] {
    const current = this.getFontFamily();
    const match = this.fontOptions.find((font) => font.stack === current || font.label === current);
    return match?.weights ?? [300, 400, 500, 600, 700];
  }

  updateFontWeight(value: string): void {
    this.updateStyle('fontWeight', value);
  }

  updateColor(value: string): void {
    this.updateStyle('color', value);
  }

  getLinkedSpacingValue(type: 'margin' | 'padding'): string {
    if (!this.node) {
      return '';
    }
    const top = this.getStyleValue(`${type}Top`);
    const right = this.getStyleValue(`${type}Right`);
    const bottom = this.getStyleValue(`${type}Bottom`);
    const left = this.getStyleValue(`${type}Left`);
    if (top && top === right && top === bottom && top === left) {
      return top;
    }
    return '';
  }

  getStyleValue(key: string, fallback = ''): string {
    if (!this.node) {
      return '';
    }
    const responsiveKey = this.resolveStyleKey(key);
    const responsiveValue = this.node.styles.default[responsiveKey];
    if (responsiveValue) {
      return responsiveValue;
    }
    const value = this.node.styles.default[key];
    if (value) {
      return value;
    }
    if (key.startsWith('margin')) {
      return this.extractFromShorthand(this.node.styles.default['margin'], key.replace('margin', '').toLowerCase());
    }
    if (key.startsWith('padding')) {
      return this.extractFromShorthand(this.node.styles.default['padding'], key.replace('padding', '').toLowerCase());
    }
    return fallback;
  }

  updateSpacing(type: 'margin' | 'padding', side: 'Top' | 'Right' | 'Bottom' | 'Left', value: string): void {
    if (!this.node) {
      return;
    }
    const key = `${type}${side}`;
    const linked = type === 'margin' ? this.linkMargin : this.linkPadding;
    this.builder.updateNode(this.node.id, (node) => {
      const target = { ...node.styles.default };
      if (linked) {
        target[this.resolveStyleKey(`${type}Top`)] = value;
        target[this.resolveStyleKey(`${type}Right`)] = value;
        target[this.resolveStyleKey(`${type}Bottom`)] = value;
        target[this.resolveStyleKey(`${type}Left`)] = value;
      } else {
        target[this.resolveStyleKey(key)] = value;
      }
      node.styles.default = target;
    });
  }

  getBorderWidth(): string {
    return this.parseBorderPart('width');
  }

  getBorderStyle(): string {
    return this.parseBorderPart('style') || 'solid';
  }

  getBorderColor(): string {
    return this.parseBorderPart('color') || '#000000';
  }

  updateBorder(width: string, style: string, color: string): void {
    const parts = [width || '0px', style || 'solid', color || '#000000'];
    this.updateStyle('border', parts.join(' '));
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

  private parseBorderPart(part: 'width' | 'style' | 'color'): string {
    if (!this.node) {
      return '';
    }
    const border = this.getStyleValue('border');
    if (!border) {
      return '';
    }
    const parts = border.split(' ').filter(Boolean);
    if (!parts.length) {
      return '';
    }
    if (part === 'width') {
      return parts[0] ?? '';
    }
    if (part === 'style') {
      return parts[1] ?? '';
    }
    return parts.slice(2).join(' ') ?? '';
  }

  private ensureFontLoaded(label: string): void {
    if (!label) {
      return;
    }
    const id = `gf-${label.replace(/\s+/g, '-')}`;
    if (document.getElementById(id)) {
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    const family = label.replace(/\s+/g, '+');
    link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
  }

  private getFontLabel(value: string): string {
    const match = this.fontOptions.find((font) => font.stack === value);
    if (match) {
      return match.label;
    }
    return value.split(',')[0]?.trim().replace(/['"]/g, '');
  }

  private extractFromShorthand(shorthand: string | undefined, side: string): string {
    if (!shorthand) {
      return '';
    }
    const parts = shorthand.split(' ').filter((part) => part.length > 0);
    if (parts.length === 1) {
      return parts[0];
    }
    if (parts.length === 2) {
      return side === 'top' || side === 'bottom' ? parts[0] : parts[1];
    }
    if (parts.length === 3) {
      if (side === 'top') {
        return parts[0];
      }
      if (side === 'bottom') {
        return parts[2];
      }
      return parts[1];
    }
    if (parts.length === 4) {
      const map: Record<string, string> = {
        top: parts[0],
        right: parts[1],
        bottom: parts[2],
        left: parts[3],
      };
      return map[side] ?? '';
    }
    return '';
  }
}
