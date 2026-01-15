import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageNode } from '../../models/page-schema';

@Component({
  selector: 'app-node-renderer',
  standalone: true,
  imports: [CommonModule, forwardRef(() => NodeRendererComponent)],
  templateUrl: './node-renderer.component.html',
  styleUrl: './node-renderer.component.scss',
})
export class NodeRendererComponent {
  @Input({ required: true }) node!: PageNode;
  @Input() selectedId: string | null = null;
  @Input() preview = false;
  @Input() parentId: string | null = null;
  @Input() index = 0;

  @Output() selectNode = new EventEmitter<PageNode>();
  @Output() startDrag = new EventEmitter<{ node: PageNode; event: MouseEvent }>();
  @Output() startResize = new EventEmitter<{ node: PageNode; event: MouseEvent }>();
  @Output()
  reorder = new EventEmitter<{
    nodeId: string;
    fromParentId: string;
    fromIndex: number;
    toParentId: string;
    toIndex: number;
  }>();

  get isSelected(): boolean {
    return this.selectedId === this.node.id;
  }

  handleSelect(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.preview) {
      this.selectNode.emit(this.node);
    }
  }

  handleMouseDown(event: MouseEvent): void {
    if (this.preview || !this.isSelected) {
      return;
    }
    if (this.node.styles.default['position'] === 'absolute') {
      this.startDrag.emit({ node: this.node, event });
    }
  }

  handleResizeMouseDown(event: MouseEvent): void {
    event.stopPropagation();
    if (this.preview || !this.isSelected) {
      return;
    }
    if (this.node.styles.default['position'] === 'absolute') {
      this.startResize.emit({ node: this.node, event });
    }
  }

  get listItems(): string[] {
    return (this.node.content?.text ?? '')
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  handleDragStart(event: DragEvent): void {
    if (this.preview || !this.parentId) {
      return;
    }
    event.dataTransfer?.setData(
      'application/json',
      JSON.stringify({ nodeId: this.node.id, fromParentId: this.parentId, fromIndex: this.index }),
    );
    event.dataTransfer?.setDragImage(this.getDragImage(), 0, 0);
  }

  handleDragOver(event: DragEvent): void {
    if (this.preview) {
      return;
    }
    event.preventDefault();
  }

  handleDrop(event: DragEvent): void {
    if (this.preview || !this.parentId) {
      return;
    }
    event.preventDefault();
    const payload = event.dataTransfer?.getData('application/json');
    if (!payload) {
      return;
    }
    const parsed = JSON.parse(payload) as {
      nodeId: string;
      fromParentId: string;
      fromIndex: number;
    };
    this.reorder.emit({
      nodeId: parsed.nodeId,
      fromParentId: parsed.fromParentId,
      fromIndex: parsed.fromIndex,
      toParentId: this.parentId,
      toIndex: this.index,
    });
  }

  handleDropInto(event: DragEvent): void {
    if (this.preview) {
      return;
    }
    event.preventDefault();
    const payload = event.dataTransfer?.getData('application/json');
    if (!payload) {
      return;
    }
    const parsed = JSON.parse(payload) as {
      nodeId: string;
      fromParentId: string;
      fromIndex: number;
    };
    this.reorder.emit({
      nodeId: parsed.nodeId,
      fromParentId: parsed.fromParentId,
      fromIndex: parsed.fromIndex,
      toParentId: this.node.id,
      toIndex: (this.node.children ?? []).length,
    });
  }

  private getDragImage(): HTMLElement {
    const ghost = document.createElement('div');
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    ghost.style.left = '-9999px';
    ghost.style.padding = '6px 10px';
    ghost.style.fontSize = '12px';
    ghost.style.fontFamily = 'inherit';
    ghost.style.background = '#0f172a';
    ghost.style.color = '#ffffff';
    ghost.style.borderRadius = '8px';
    ghost.textContent = this.node.meta?.name ?? this.node.type;
    document.body.appendChild(ghost);
    window.setTimeout(() => ghost.remove(), 0);
    return ghost;
  }
}
