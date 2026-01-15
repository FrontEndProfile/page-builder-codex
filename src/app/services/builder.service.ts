import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PageDocument, PageNode, NodeType } from '../models/page-schema';
import { FirebaseDataService } from './firebase-data.service';
import { createNode, deepClone } from '../utils/page-builder-utils';

@Injectable({ providedIn: 'root' })
export class BuilderService {
  private pageSubject = new BehaviorSubject<PageDocument | null>(null);
  private selectedIdSubject = new BehaviorSubject<string | null>(null);
  private history: PageDocument[] = [];
  private historyIndex = -1;
  private saveTimer: number | null = null;
  private snapshotTimer: number | null = null;
  private projectId: string | null = null;

  page$ = this.pageSubject.asObservable();
  selectedId$ = this.selectedIdSubject.asObservable();

  constructor(private dataService: FirebaseDataService) {}

  async loadPage(projectId: string, pageId: string): Promise<PageDocument | null> {
    const page = await this.dataService.getPage(projectId, pageId);
    if (!page) {
      return null;
    }
    this.projectId = projectId;
    this.pageSubject.next(page);
    this.selectedIdSubject.next(null);
    this.history = [deepClone(page)];
    this.historyIndex = 0;
    return page;
  }

  get currentPage(): PageDocument | null {
    return this.pageSubject.value;
  }

  get selectedId(): string | null {
    return this.selectedIdSubject.value;
  }

  selectNode(nodeId: string | null): void {
    this.selectedIdSubject.next(nodeId);
  }

  addNode(type: NodeType, parentId?: string): void {
    const page = this.currentPage;
    if (!page) {
      return;
    }
    const node = createNode(type);
    const parent = parentId ? this.findNode(page.root, parentId) : page.root;
    if (!parent) {
      return;
    }
    parent.children = parent.children ?? [];
    parent.children.push(node);
    this.touch(page);
    this.selectNode(node.id);
  }

  updateNode(nodeId: string, updater: (node: PageNode) => void): void {
    const page = this.currentPage;
    if (!page) {
      return;
    }
    const node = this.findNode(page.root, nodeId);
    if (!node) {
      return;
    }
    updater(node);
    this.touch(page);
  }

  deleteNode(nodeId: string): void {
    const page = this.currentPage;
    if (!page || page.root.id === nodeId) {
      return;
    }
    const removed = this.removeNode(page.root, nodeId);
    if (removed) {
      this.touch(page);
      this.selectNode(null);
    }
  }

  moveNode(nodeId: string, targetParentId: string, targetIndex: number): void {
    const page = this.currentPage;
    if (!page || page.root.id === nodeId) {
      return;
    }
    const origin = this.findParent(page.root, nodeId);
    if (!origin) {
      return;
    }
    const originChildren = origin.parent.children ?? [];
    const node = originChildren[origin.index];
    if (!node) {
      return;
    }
    const targetParent = this.findNode(page.root, targetParentId);
    if (!targetParent) {
      return;
    }
    if (this.findNode(node, targetParentId)) {
      return;
    }
    targetParent.children = targetParent.children ?? [];
    const [moved] = originChildren.splice(origin.index, 1);
    if (!moved) {
      return;
    }
    let insertIndex = targetIndex;
    if (origin.parent.id === targetParentId && origin.index < targetIndex) {
      insertIndex = Math.max(0, targetIndex - 1);
    }
    targetParent.children.splice(Math.min(insertIndex, targetParent.children.length), 0, moved);
    this.touch(page);
    this.selectNode(moved.id);
  }

  updatePageSettings(partial: Partial<PageDocument['settings']>): void {
    const page = this.currentPage;
    if (!page) {
      return;
    }
    page.settings = { ...page.settings, ...partial };
    this.touch(page);
  }

  save(): void {
    const page = this.currentPage;
    if (!page || !this.projectId) {
      return;
    }
    page.updatedAt = Date.now();
    void this.dataService.updatePage(this.projectId, page);
  }

  undo(): void {
    if (this.historyIndex <= 0) {
      return;
    }
    this.historyIndex -= 1;
    const snapshot = deepClone(this.history[this.historyIndex]);
    this.pageSubject.next(snapshot);
    this.selectNode(null);
    this.scheduleSave();
  }

  redo(): void {
    if (this.historyIndex >= this.history.length - 1) {
      return;
    }
    this.historyIndex += 1;
    const snapshot = deepClone(this.history[this.historyIndex]);
    this.pageSubject.next(snapshot);
    this.selectNode(null);
    this.scheduleSave();
  }

  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  private touch(page: PageDocument): void {
    page.updatedAt = Date.now();
    this.pageSubject.next(page);
    this.scheduleSave();
    this.scheduleSnapshot();
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => this.save(), 600);
  }

  private scheduleSnapshot(): void {
    if (this.snapshotTimer) {
      window.clearTimeout(this.snapshotTimer);
    }
    this.snapshotTimer = window.setTimeout(() => this.captureSnapshot(), 400);
  }

  private captureSnapshot(): void {
    const page = this.currentPage;
    if (!page) {
      return;
    }
    const snapshot = deepClone(page);
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(snapshot);
    if (this.history.length > 50) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }

  private findNode(node: PageNode, id: string): PageNode | null {
    if (node.id === id) {
      return node;
    }
    for (const child of node.children ?? []) {
      const found = this.findNode(child, id);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private findParent(
    node: PageNode,
    childId: string,
  ): { parent: PageNode; index: number } | null {
    const children = node.children ?? [];
    const index = children.findIndex((child) => child.id === childId);
    if (index !== -1) {
      return { parent: node, index };
    }
    for (const child of children) {
      const found = this.findParent(child, childId);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private removeNode(node: PageNode, id: string): boolean {
    if (!node.children) {
      return false;
    }
    const index = node.children.findIndex((child) => child.id === id);
    if (index !== -1) {
      node.children.splice(index, 1);
      return true;
    }
    return node.children.some((child) => this.removeNode(child, id));
  }
}
