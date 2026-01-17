import { Injectable } from '@angular/core';
import { FirebaseDataService } from './firebase-data.service';
import { PageDocument } from '../models/page-schema';

@Injectable({ providedIn: 'root' })
export class PagesService {
  constructor(private dataService: FirebaseDataService) {}

  addPage(projectId: string, page: PageDocument): Promise<void> {
    return this.dataService.addPage(projectId, page);
  }

  updatePage(projectId: string, page: PageDocument): Promise<void> {
    return this.dataService.updatePage(projectId, page);
  }

  deletePage(projectId: string, pageId: string): Promise<void> {
    return this.dataService.deletePage(projectId, pageId);
  }

  duplicatePage(projectId: string, pageId: string): Promise<PageDocument | null> {
    return this.dataService.duplicatePage(projectId, pageId);
  }

  getPage(projectId: string, pageId: string): Promise<PageDocument | null> {
    return this.dataService.getPage(projectId, pageId);
  }

  addVersion(projectId: string, pageId: string, page: PageDocument, note: string): Promise<void> {
    return this.dataService.addVersion(projectId, pageId, page, note);
  }

  getNextVersionNumber(projectId: string, pageId: string): Promise<number> {
    return this.dataService.getNextVersionNumber(projectId, pageId);
  }

  listVersions(
    projectId: string,
    pageId: string,
  ): Promise<{ id: string; createdAt: number; note: string }[]> {
    return this.dataService.listVersions(projectId, pageId);
  }

  getVersionSnapshot(projectId: string, pageId: string, versionId: string): Promise<PageDocument | null> {
    return this.dataService.getVersionSnapshot(projectId, pageId, versionId);
  }
}
