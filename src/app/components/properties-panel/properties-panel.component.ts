import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageNode } from '../../models/page-schema';
import { BuilderService } from '../../services/builder.service';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.scss',
})
export class PropertiesPanelComponent {
  @Input() node: PageNode | null = null;

  activeTab: 'content' | 'typography' | 'spacing' | 'layout' | 'position' | 'states' = 'content';
  linkMargin = true;
  linkPadding = true;

  constructor(private builder: BuilderService) {}

  setTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  updateContent(key: keyof NonNullable<PageNode['content']>, value: string): void {
    if (!this.node) {
      return;
    }
    this.builder.updateNode(this.node.id, (node) => {
      node.content = { ...(node.content ?? {}), [key]: value };
    });
  }

  updateStyle(key: string, value: string, state: 'default' | 'hover' = 'default'): void {
    if (!this.node) {
      return;
    }
    this.builder.updateNode(this.node.id, (node) => {
      if (state === 'default') {
        node.styles.default = { ...node.styles.default, [key]: value };
      } else {
        node.styles.hover = { ...(node.styles.hover ?? {}), [key]: value };
      }
    });
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
        target[`${type}Top`] = value;
        target[`${type}Right`] = value;
        target[`${type}Bottom`] = value;
        target[`${type}Left`] = value;
      } else {
        target[key] = value;
      }
      node.styles.default = target;
    });
  }

  getStyleValue(key: string, fallback = ''): string {
    if (!this.node) {
      return '';
    }
    const value = this.node.styles.default[key];
    if (value) {
      return value;
    }
    if (key.startsWith('margin')) {
      return this.extractFromShorthand(this.node.styles.default.margin, key.replace('margin', '').toLowerCase());
    }
    if (key.startsWith('padding')) {
      return this.extractFromShorthand(this.node.styles.default.padding, key.replace('padding', '').toLowerCase());
    }
    return fallback;
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
