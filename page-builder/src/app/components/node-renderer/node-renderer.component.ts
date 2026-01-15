import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageNode } from '../../models/page-schema';

@Component({
  selector: 'app-node-renderer',
  standalone: true,
  imports: [CommonModule, NodeRendererComponent],
  templateUrl: './node-renderer.component.html',
  styleUrl: './node-renderer.component.scss',
})
export class NodeRendererComponent {
  @Input({ required: true }) node!: PageNode;
  @Input() selectedId: string | null = null;
  @Input() preview = false;

  @Output() selectNode = new EventEmitter<PageNode>();
  @Output() startDrag = new EventEmitter<{ node: PageNode; event: MouseEvent }>();
  @Output() startResize = new EventEmitter<{ node: PageNode; event: MouseEvent }>();

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
    if (this.node.styles.default.position === 'absolute') {
      this.startDrag.emit({ node: this.node, event });
    }
  }

  handleResizeMouseDown(event: MouseEvent): void {
    event.stopPropagation();
    if (this.preview || !this.isSelected) {
      return;
    }
    if (this.node.styles.default.position === 'absolute') {
      this.startResize.emit({ node: this.node, event });
    }
  }

  get listItems(): string[] {
    return (this.node.content?.text ?? '')
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}
